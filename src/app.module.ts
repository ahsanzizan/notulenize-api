import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { AuthModule } from '@/core/auth/auth.module';
import { UploadModule } from '@/core/upload/upload.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const required = [
          'DATABASE_URL',
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'SUPABASE_BUCKET',
        ];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
          }
        }
        return config;
      },
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: 3,
      },
    }),
    PrismaModule,
    AuthModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
