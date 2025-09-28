import { PrismaService } from '@/prisma/prisma.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { UploadStatus } from '@prisma/client';
import { Job } from 'bull';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AudioProcessorJob } from './types/audio-processor.type';
import { AssemblyAIService } from '@/assemblyai/assemblyai.service';

@Processor('audio-processing')
export class AudioProcessingProcessor {
  private readonly logger = new Logger(AudioProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly assembly: AssemblyAIService,
  ) {}

  @Process('process-file')
  async processFile(job: Job<AudioProcessorJob>) {
    const { uploadId, filePath, fileType, userId, filename, meetingTitle } =
      job.data;

    this.logger.log(`Processing file for upload ${uploadId}`);

    try {
      let audioFilePath = filePath;
      let audioFilename = filename;

      // If it's a video, extract audio
      if (fileType.startsWith('video/')) {
        this.logger.log(`Extracting audio from video: ${filename}`);
        audioFilePath = await this.extractAudio(filePath);
        audioFilename = filename.replace(/\.[^/.]+$/, '.mp3');
      }

      // Upload audio to Supabase
      this.logger.log(
        `Uploading audio to Supabase: ${audioFilePath} (${audioFilename})`,
      );
      const audioBuffer = await fs.readFile(audioFilePath);
      const supabaseResponse = await this.supabase.uploadFile(
        audioFilename,
        audioBuffer,
      );

      const audioFilePublicUrl = supabaseResponse.publicUrl;

      // Create meeting record
      const meeting = await this.prisma.meeting.create({
        data: {
          title: meetingTitle || audioFilename,
          userId,
          audioFileUrl: audioFilePublicUrl,
        },
      });

      this.logger.log(`Created meeting ${meeting.id}`);

      // Transcription
      const transcriptText =
        await this.generateTranscription(audioFilePublicUrl);

      // Create transcript
      const transcript = await this.prisma.transcript.create({
        data: {
          meetingId: meeting.id,
          fullText: transcriptText,
        },
      });

      // Chunk transcript
      await this.chunkTranscript(transcript.id, transcriptText);

      // Cleanup temp files
      await this.cleanupFiles(filePath, audioFilePath);

      this.logger.log(`Successfully processed file for upload ${uploadId}`);
    } catch (error) {
      this.logger.error(
        `Error processing file for upload ${uploadId}: ${error.message}`,
        error.stack,
      );

      // Update upload session status to failed
      await this.markUploadAsFailed(uploadId, error.message);

      // Cleanup temp files even on error
      try {
        await this.cleanupFiles(filePath, null);
      } catch (cleanupError) {
        this.logger.error(`Error during cleanup: ${cleanupError.message}`);
      }

      throw error;
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const audioPath = videoPath.replace(/\.[^/.]+$/, '.mp3');

      ffmpeg(videoPath)
        .toFormat('mp3')
        .audioCodec('mp3')
        .audioBitrate(128)
        .on('end', () => {
          this.logger.log(`Audio extraction completed: ${audioPath}`);
          resolve(audioPath);
        })
        .on('error', (err) => {
          this.logger.error(`Audio extraction failed: ${err.message}`);
          reject(new Error(`Audio extraction failed: ${err.message}`));
        })
        .on('progress', (progress) => {
          this.logger.debug(`Audio extraction progress: ${progress.percent}%`);
        })
        .save(audioPath);
    });
  }

  private async generateTranscription(audioFileUrl: string): Promise<string> {
    try {
      this.logger.log('Starting transcription via AssemblyAIService');
      const text = await this.assembly.transcribeFromUrl(audioFileUrl);
      this.logger.log('Transcription completed with AssemblyAI');
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AssemblyAI transcription error: ${message}`);
      throw err;
    }
  }

  private async chunkTranscript(transcriptId: string, fullText: string) {
    const chunkSize = 800;
    const overlap = 100;
    const chunks = [];

    for (let i = 0; i < fullText.length; i += chunkSize - overlap) {
      const chunk = fullText.slice(i, Math.min(i + chunkSize, fullText.length));
      chunks.push({
        transcriptId,
        chunkIndex: Math.floor(i / (chunkSize - overlap)),
        content: chunk.trim(),
      });
    }

    await this.prisma.transcriptChunk.createMany({
      data: chunks,
    });

    this.logger.log(`Created ${chunks.length} transcript chunks`);
  }

  private async cleanupFiles(originalPath: string, audioPath?: string) {
    try {
      // Remove original file
      await fs.unlink(originalPath);

      // Remove audio file if different from original
      if (audioPath && audioPath !== originalPath) {
        await fs.unlink(audioPath);
      }

      // Remove session directory
      const sessionDir = path.dirname(originalPath);
      await fs.rmdir(sessionDir, { recursive: true });

      this.logger.log(
        `Cleaned up temporary files and directory: ${sessionDir}`,
      );
    } catch (error) {
      this.logger.error(`Error during file cleanup: ${error.message}`);
    }
  }

  private async markUploadAsFailed(uploadId: string, errorMessage: string) {
    try {
      await this.prisma.uploadSession.update({
        where: { id: uploadId },
        data: {
          status: UploadStatus.FAILED,
          errorMessage: errorMessage.substring(0, 500),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to mark upload as failed: ${error.message}`);
    }
  }
}
