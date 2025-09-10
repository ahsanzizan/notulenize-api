import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { UploadStatus } from '@prisma/client';
import { Job } from 'bull';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AudioProcessorJob } from './audio-processor.type';

@Processor('audio-processing')
export class AudioProcessingProcessor {
  private readonly logger = new Logger(AudioProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
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
      this.logger.log(`Uploading audio to Supabase: ${audioFilename}`);
      const audioBuffer = await fs.readFile(audioFilePath);
      const supabaseResponse = await this.supabase.uploadFile(
        audioFilename,
        audioBuffer,
      );

      // Create meeting record
      const meeting = await this.prisma.meeting.create({
        data: {
          title: meetingTitle || audioFilename,
          userId,
          audioFileUrl: supabaseResponse.publicUrl,
        },
      });

      this.logger.log(`Created meeting ${meeting.id}`);

      // Mock transcription
      const transcriptText = await this.mockTranscription(audioFilePath);

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

  private async mockTranscription(audioPath: string): Promise<string> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stats = await fs.stat(audioPath);
    const fileSize = Math.round(stats.size / 1024); // KB

    return `This is a mock transcription of the audio file (${fileSize}KB). In a real implementation, this would be the actual transcribed text from a service like OpenAI Whisper, Google Speech-to-Text, or similar. The transcription would contain the actual spoken content from the audio file.`;
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
