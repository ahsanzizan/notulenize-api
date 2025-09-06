import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { Readable } from 'stream';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // New streaming video upload endpoint (more efficient)
  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp', // Temporary storage for streaming processing
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `temp-video-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'video/mp4',
          'video/avi',
          'video/mov',
          'video/wmv',
          'video/flv',
          'video/webm',
          'video/mkv',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Only video files are allowed.',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100000000, // 100MB default
      },
    }),
  )
  async uploadVideoStream(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.uploadService.processVideoStreaming(file, title, description);
  }

  // New streaming audio upload endpoint (more efficient)
  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp', // Temporary storage for streaming processing
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `temp-audio-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'audio/mp3',
          'audio/mpeg',
          'audio/wav',
          'audio/m4a',
          'audio/aac',
          'audio/ogg',
          'audio/flac',
          'audio/webm',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Only audio files are allowed.',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100000000, // 100MB default
      },
    }),
  )
  async uploadAudioStream(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No audio file uploaded');
    }

    return this.uploadService.processAudioStreaming(file, title, description);
  }

  // Optional: Pure streaming endpoint (no temp files at all)
  // This would require custom handling of multipart uploads
  @Post('stream/direct')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // Store in memory buffer
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'video/mp4',
          'video/avi',
          'video/mov',
          'video/wmv',
          'video/flv',
          'video/webm',
          'video/mkv',
          'audio/mp3',
          'audio/mpeg',
          'audio/wav',
          'audio/m4a',
          'audio/aac',
          'audio/ogg',
          'audio/flac',
          'audio/webm',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Only video and audio files are allowed.',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100000000, // 100MB default
      },
    }),
  )
  async uploadDirect(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Convert buffer to readable stream
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null); // Signal end of stream

    return this.uploadService.processUploadStream(
      stream,
      file.originalname,
      file.mimetype,
      title,
      description,
    );
  }
}
