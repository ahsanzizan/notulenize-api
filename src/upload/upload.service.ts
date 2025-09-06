import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import { PassThrough, Readable } from 'stream';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFactory } from '../storage/storage.factory';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const unlink = promisify(fs.unlink);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageFactory: StorageFactory,
  ) {}

  async processVideoStreaming(
    file: Express.Multer.File,
    title?: string,
    description?: string,
  ) {
    const tempVideoPath = file.path;

    try {
      // Create meeting record
      const meeting = await this.prisma.meeting.create({
        data: {
          title: title || 'Untitled Meeting',
          description: description || null,
        },
      });

      // Extract audio directly and stream it to storage
      const audioStream = this.createAudioStream(file.path);
      const storageService = this.storageFactory.getStorageService();

      // Generate filename for audio
      const audioFileName = `${meeting.id}-${Date.now()}.wav`;

      // Upload audio stream directly to storage
      const audioFile = await storageService.uploadStream(
        audioStream,
        audioFileName,
        {
          folder: 'audio',
          contentType: 'audio/wav',
          metadata: {
            meetingId: meeting.id,
            type: 'audio',
            originalVideoName: file.originalname,
          },
        },
      );

      // Clean up temporary video file
      await this.cleanupTempFile(tempVideoPath);

      this.logger.log(
        `Video processed successfully via streaming. Meeting ID: ${meeting.id}`,
      );

      return {
        meetingId: meeting.id,
        fileId: audioFile.filename,
        originalName: file.originalname,
        audioPath: audioFile.path,
        audioUrl: audioFile.url,
        message: 'Video processed and audio extracted via streaming',
      };
    } catch (error) {
      // Cleanup on error
      await this.cleanupTempFile(tempVideoPath);
      this.logger.error('Error processing video via streaming:', error);
      throw error;
    }
  }

  private createAudioStream(videoPath: string): PassThrough {
    const audioStream = new PassThrough();

    const command = ffmpeg(videoPath)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => {
        this.logger.log('Audio extraction stream completed');
        audioStream.end();
      })
      .on('error', (err) => {
        this.logger.error('Error in audio extraction stream:', err);
        audioStream.destroy(err);
      });

    // Pipe the audio output directly to our PassThrough stream
    command.pipe(audioStream, { end: false });

    return audioStream;
  }

  async processAudioStreaming(
    file: Express.Multer.File,
    title?: string,
    description?: string,
  ) {
    const tempAudioPath = file.path;

    try {
      // Create meeting record
      const meeting = await this.prisma.meeting.create({
        data: {
          title: title || 'Untitled Audio Meeting',
          description: description || null,
        },
      });

      let audioStream: PassThrough;

      // Check if conversion is needed
      if (file.originalname.toLowerCase().endsWith('.wav')) {
        // If already WAV, create a read stream
        audioStream = new PassThrough();
        fs.createReadStream(file.path).pipe(audioStream);
      } else {
        // Convert to WAV via streaming
        audioStream = this.createAudioConversionStream(file.path);
      }

      const storageService = this.storageFactory.getStorageService();
      const audioFileName = `${meeting.id}-${Date.now()}.wav`;

      // Upload audio stream directly
      const audioFile = await storageService.uploadStream(
        audioStream,
        audioFileName,
        {
          folder: 'audio',
          contentType: 'audio/wav',
          metadata: {
            meetingId: meeting.id,
            type: 'audio',
            originalFileName: file.originalname,
          },
        },
      );

      // Clean up temporary file
      await this.cleanupTempFile(tempAudioPath);

      this.logger.log(
        `Audio processed successfully via streaming. Meeting ID: ${meeting.id}`,
      );

      return {
        meetingId: meeting.id,
        fileId: audioFile.filename,
        originalName: file.originalname,
        audioPath: audioFile.path,
        audioUrl: audioFile.url,
        message: 'Audio processed via streaming',
      };
    } catch (error) {
      await this.cleanupTempFile(tempAudioPath);
      this.logger.error('Error processing audio via streaming:', error);
      throw error;
    }
  }

  private createAudioConversionStream(audioPath: string): PassThrough {
    const audioStream = new PassThrough();

    const command = ffmpeg(audioPath)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => {
        this.logger.log('Audio conversion stream completed');
        audioStream.end();
      })
      .on('error', (err) => {
        this.logger.error('Error in audio conversion stream:', err);
        audioStream.destroy(err);
      });

    command.pipe(audioStream, { end: false });

    return audioStream;
  }

  // Alternative: Process directly from upload stream (no temp files)
  async processUploadStream(
    uploadStream: Readable,
    originalName: string,
    contentType: string,
    title?: string,
    description?: string,
  ) {
    try {
      // Create meeting record
      const meeting = await this.prisma.meeting.create({
        data: {
          title: title || 'Untitled Meeting',
          description: description || null,
        },
      });

      // Determine if we need audio extraction or conversion
      const isVideo = contentType.startsWith('video/');
      const isAudio = contentType.startsWith('audio/');

      if (!isVideo && !isAudio) {
        throw new Error('Unsupported file type');
      }

      // Create audio processing stream
      const audioStream = this.createProcessingStreamFromUpload(
        uploadStream,
        isVideo,
      );

      const storageService = this.storageFactory.getStorageService();
      const audioFileName = `${meeting.id}-${Date.now()}.wav`;

      // Upload processed audio stream
      const audioFile = await storageService.uploadStream(
        audioStream,
        audioFileName,
        {
          folder: 'audio',
          contentType: 'audio/wav',
          metadata: {
            meetingId: meeting.id,
            type: 'audio',
            originalFileName: originalName,
            sourceType: isVideo ? 'video' : 'audio',
          },
        },
      );

      this.logger.log(
        `Upload stream processed successfully. Meeting ID: ${meeting.id}`,
      );

      return {
        meetingId: meeting.id,
        fileId: audioFile.filename,
        originalName: originalName,
        audioPath: audioFile.path,
        audioUrl: audioFile.url,
        message: 'Upload stream processed successfully',
      };
    } catch (error) {
      this.logger.error('Error processing upload stream:', error);
      throw error;
    }
  }

  private createProcessingStreamFromUpload(
    inputStream: Readable,
    isVideo: boolean,
  ): PassThrough {
    const audioStream = new PassThrough();

    const command = ffmpeg(inputStream)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000);

    if (isVideo) {
      // For video files, we only want the audio track
      command.noVideo();
    }

    command
      .on('end', () => {
        this.logger.log('Stream processing completed');
        audioStream.end();
      })
      .on('error', (err) => {
        this.logger.error('Error in stream processing:', err);
        audioStream.destroy(err);
      })
      .pipe(audioStream, { end: false });

    return audioStream;
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  async getFileInfo(fileId: string) {
    const storageService = this.storageFactory.getStorageService();

    // Since we're only storing audio now, just check the audio folder
    const filePath = `audio/${fileId}`;
    if (await storageService.exists(filePath)) {
      const url = await storageService.getUrl(filePath);
      return {
        fileId,
        path: filePath,
        url,
        exists: true,
      };
    }

    throw new Error('File not found');
  }
}
