import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseUploadException } from '../common/exceptions/upload.exceptions';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabase: SupabaseClient;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    this.logger.log('Supabase client initialized');
  }

  async uploadFile(filename: string, fileBuffer: Buffer) {
    try {
      // Generate unique filename to prevent conflicts
      const uniqueFilename = `${Date.now()}-${filename}`;

      const { data, error } = await this.supabase.storage
        .from('audio-files')
        .upload(uniqueFilename, fileBuffer, {
          contentType: 'audio/mpeg',
          upsert: false,
        });

      if (error) {
        this.logger.error(`Supabase upload error: ${error.message}`);
        throw new SupabaseUploadException(error.message);
      }

      const { data: publicUrlData } = this.supabase.storage
        .from('audio-files')
        .getPublicUrl(uniqueFilename);

      this.logger.log(`File uploaded successfully: ${uniqueFilename}`);

      return {
        path: data.path,
        publicUrl: publicUrlData.publicUrl,
        filename: uniqueFilename,
      };
    } catch (error) {
      if (error instanceof SupabaseUploadException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error during file upload: ${error.message}`,
      );
      throw new SupabaseUploadException(`Unexpected error: ${error.message}`);
    }
  }
}
