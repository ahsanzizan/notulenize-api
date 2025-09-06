import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFactory } from '../storage/storage.factory';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageFactory: StorageFactory,
  ) {}

  async processVideo(
    file: Express.Multer.File,
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

      // Store video file using storage service
      const storageService = this.storageFactory.getStorageService();
      const videoFile = await storageService.upload(file, {
        folder: 'videos',
        metadata: { meetingId: meeting.id, type: 'video' },
      });

      // Extract audio from video
      const audioPath = await this.extractAudio(file.path);

      // Store audio file using storage service
      const audioFile = await storageService.upload(
        {
          ...file,
          path: audioPath,
          filename: path.basename(audioPath),
        } as Express.Multer.File,
        {
          folder: 'audio',
          metadata: {
            meetingId: meeting.id,
            type: 'audio',
            sourceVideo: videoFile.path,
          },
        },
      );

      this.logger.log(
        `Video processed successfully. Meeting ID: ${meeting.id}`,
      );

      return {
        meetingId: meeting.id,
        fileId: videoFile.filename,
        originalName: file.originalname,
        videoPath: videoFile.path,
        audioPath: audioFile.path,
        videoUrl: videoFile.url,
        audioUrl: audioFile.url,
        message: 'Video uploaded and audio extracted successfully',
      };
    } catch (error) {
      this.logger.error('Error processing video:', error);
      throw error;
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const audioPath = videoPath.replace(/\.[^/.]+$/, '.wav');

      ffmpeg(videoPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
          this.logger.log(`Audio extracted to: ${audioPath}`);
          resolve(audioPath);
        })
        .on('error', (err) => {
          this.logger.error('Error extracting audio:', err);
          reject(err);
        })
        .save(audioPath);
    });
  }

  async processAudio(
    file: Express.Multer.File,
    title?: string,
    description?: string,
  ) {
    try {
      // Create meeting record
      const meeting = await this.prisma.meeting.create({
        data: {
          title: title || 'Untitled Audio Meeting',
          description: description || null,
        },
      });

      // Convert audio to WAV format if needed
      const audioPath = await this.convertAudioToWav(file.path);

      // Store audio file using storage service
      const storageService = this.storageFactory.getStorageService();
      const audioFile = await storageService.upload(
        {
          ...file,
          path: audioPath,
          filename: path.basename(audioPath),
        } as Express.Multer.File,
        {
          folder: 'audio',
          metadata: { meetingId: meeting.id, type: 'audio' },
        },
      );

      this.logger.log(
        `Audio processed successfully. Meeting ID: ${meeting.id}`,
      );

      return {
        meetingId: meeting.id,
        fileId: audioFile.filename,
        originalName: file.originalname,
        audioPath: audioFile.path,
        audioUrl: audioFile.url,
        message: 'Audio uploaded and processed successfully',
      };
    } catch (error) {
      this.logger.error('Error processing audio:', error);
      throw error;
    }
  }

  private async convertAudioToWav(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const wavPath = audioPath.replace(/\.[^/.]+$/, '.wav');

      // If already WAV, just return the path
      if (audioPath.toLowerCase().endsWith('.wav')) {
        resolve(audioPath);
        return;
      }

      ffmpeg(audioPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
          this.logger.log(`Audio converted to WAV: ${wavPath}`);
          resolve(wavPath);
        })
        .on('error', (err) => {
          this.logger.error('Error converting audio to WAV:', err);
          reject(err);
        })
        .save(wavPath);
    });
  }

  async getFileInfo(fileId: string) {
    const storageService = this.storageFactory.getStorageService();

    // Try to find the file in different folders
    const folders = ['videos', 'audio', 'files'];

    for (const folder of folders) {
      const filePath = `${folder}/${fileId}`;
      if (await storageService.exists(filePath)) {
        const url = await storageService.getUrl(filePath);
        return {
          fileId,
          path: filePath,
          url,
          exists: true,
        };
      }
    }

    throw new Error('File not found');
  }
}
