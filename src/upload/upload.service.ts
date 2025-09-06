import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly prisma: PrismaService) {}

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

      // Extract audio from video
      const audioPath = await this.extractAudio(file.path);

      this.logger.log(
        `Video processed successfully. Meeting ID: ${meeting.id}`,
      );

      return {
        meetingId: meeting.id,
        fileId: file.filename,
        originalName: file.originalname,
        audioPath: audioPath,
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

  async getFileInfo(fileId: string) {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const filePath = path.join(uploadPath, fileId);

    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const stats = fs.statSync(filePath);
    return {
      fileId,
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
    };
  }
}
