import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { UploadStatus } from '@prisma/client';
import { Queue } from 'bull';
import * as fs from 'fs/promises';
import * as path from 'path';
import { InitUploadDto } from '../common/dto/upload.dto';
import {
  FileProcessingException,
  InvalidUploadStatusException,
  UploadSessionNotFoundException,
} from '../common/exceptions/upload.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { AudioProcessorJob } from './processors/audio-processor.type';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly tempDir = path.join(process.cwd(), 'temp');

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('audio-processing')
    private readonly audioQueue: Queue<AudioProcessorJob>,
  ) {
    this.ensureTempDirectory();
  }

  private async ensureTempDirectory() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
      this.logger.log(`Created temp directory: ${this.tempDir}`);
    }
  }

  async initUpload(dto: InitUploadDto) {
    try {
      const uploadSession = await this.prisma.uploadSession.create({
        data: {
          userId: dto.userId,
          filename: dto.filename,
          fileType: dto.fileType,
          totalParts: dto.totalParts,
          status: UploadStatus.IN_PROGRESS,
        },
      });

      const sessionDir = path.join(this.tempDir, uploadSession.id);
      await fs.mkdir(sessionDir, { recursive: true });

      this.logger.log(`Upload session ${uploadSession.id} initialized`);

      return {
        uploadId: uploadSession.id,
        status: 'initialized',
      };
    } catch (error) {
      this.logger.error(
        `Failed to initialize upload: ${error.message}`,
        error.stack,
      );
      throw new FileProcessingException(
        `Failed to initialize upload: ${error.message}`,
      );
    }
  }

  async uploadPart(
    uploadId: string,
    chunk: Express.Multer.File,
    partIndex: number,
  ) {
    const session = await this.getUploadSession(uploadId);

    if (session.status !== UploadStatus.IN_PROGRESS) {
      throw new InvalidUploadStatusException(session.status);
    }

    try {
      const sessionDir = path.join(this.tempDir, uploadId);
      const partPath = path.join(sessionDir, `part-${partIndex}`);

      await fs.writeFile(partPath, chunk.buffer);

      this.logger.log(`Part ${partIndex} uploaded for session ${uploadId}`);

      return {
        partIndex,
        status: 'uploaded',
        size: chunk.size,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload part ${partIndex}: ${error.message}`,
        error.stack,
      );
      throw new FileProcessingException(
        `Failed to upload part: ${error.message}`,
      );
    }
  }

  async completeUpload(uploadId: string) {
    const session = await this.getUploadSession(uploadId);

    if (session.status !== UploadStatus.IN_PROGRESS) {
      throw new InvalidUploadStatusException(session.status);
    }

    try {
      const sessionDir = path.join(this.tempDir, uploadId);
      const finalFilePath = path.join(sessionDir, session.filename);

      // Verify all parts exist
      await this.verifyAllParts(sessionDir, session.totalParts);

      // Assemble parts
      await this.assembleParts(sessionDir, finalFilePath, session.totalParts);

      // Update session status
      await this.prisma.uploadSession.update({
        where: { id: uploadId },
        data: { status: UploadStatus.COMPLETED },
      });

      // Queue audio processing job
      await this.audioQueue.add('process-file', {
        uploadId,
        filePath: finalFilePath,
        fileType: session.fileType,
        userId: session.userId,
        filename: session.filename,
      });

      this.logger.log(`Upload ${uploadId} completed and queued for processing`);

      return {
        uploadId,
        status: 'completed',
        message: 'File uploaded successfully. Processing started.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete upload ${uploadId}: ${error.message}`,
        error.stack,
      );

      await this.markUploadAsFailed(uploadId, error.message);
      throw new FileProcessingException(
        `Failed to complete upload: ${error.message}`,
      );
    }
  }

  private async getUploadSession(uploadId: string) {
    const session = await this.prisma.uploadSession.findUnique({
      where: { id: uploadId },
    });

    if (!session) {
      throw new UploadSessionNotFoundException(uploadId);
    }

    return session;
  }

  private async verifyAllParts(sessionDir: string, totalParts: number) {
    const missingParts = [];

    for (let i = 0; i < totalParts; i++) {
      const partPath = path.join(sessionDir, `part-${i}`);
      try {
        await fs.access(partPath);
      } catch {
        missingParts.push(i);
      }
    }

    if (missingParts.length > 0) {
      throw new Error(`Missing parts: ${missingParts.join(', ')}`);
    }
  }

  private async assembleParts(
    sessionDir: string,
    finalFilePath: string,
    totalParts: number,
  ) {
    const writeHandle = await fs.open(finalFilePath, 'w');

    try {
      for (let i = 0; i < totalParts; i++) {
        const partPath = path.join(sessionDir, `part-${i}`);
        const partData = await fs.readFile(partPath);
        await writeHandle.write(partData);
        await fs.unlink(partPath);
      }
    } finally {
      await writeHandle.close();
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
