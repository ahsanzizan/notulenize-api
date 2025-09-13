import { PrismaModule } from '@/prisma/prisma.module';
import { SupabaseModule } from '@/supabase/supabase.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { AudioProcessingProcessor } from './processors/audio-processing.processor';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per chunk
      },
    }),
    BullModule.registerQueue({
      name: 'audio-processing',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, AudioProcessingProcessor],
})
export class UploadModule {}
