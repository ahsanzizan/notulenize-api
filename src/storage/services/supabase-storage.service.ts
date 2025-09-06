import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import {
  StorageFile,
  StorageService,
  StreamUploadOptions,
  UploadOptions,
} from '../interfaces/storage.interface';

@Injectable()
export class SupabaseStorageService implements StorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    this.bucket =
      this.configService.get<string>('SUPABASE_BUCKET') || 'notulenize-files';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Anon Key are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async upload(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<StorageFile> {
    try {
      const folder = options.folder || 'files';
      const filename = options.filename || file.filename;
      const filePath = `${folder}/${filename}`;

      const fileBuffer = fs.readFileSync(file.path);

      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
          metadata: options.metadata || {},
        });

      if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(filePath);

      const storageFile: StorageFile = {
        filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: filePath,
        url: publicUrlData.publicUrl,
        metadata: options.metadata,
      };

      this.logger.log(`File uploaded to Supabase: ${filePath}`);
      return storageFile;
    } catch (error) {
      this.logger.error('Error uploading file to Supabase:', error);
      throw error;
    }
  }

  async uploadStream(
    stream: NodeJS.ReadableStream,
    filename: string,
    options: StreamUploadOptions = {},
  ): Promise<StorageFile> {
    try {
      const folder = options.folder || 'files';
      const filePath = `${folder}/${filename}`;

      // Convert stream to buffer for Supabase
      // Note: This loads the entire stream into memory
      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      // Handle the stream data
      for await (const chunk of stream as any) {
        chunks.push(chunk);
        totalSize += chunk.length;
      }

      const buffer = Buffer.concat(chunks);
      const contentType = options.contentType || this.getMimeType(filename);

      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(filePath, buffer, {
          contentType,
          metadata: options.metadata || {},
        });

      if (error) {
        throw new Error(`Supabase stream upload error: ${error.message}`);
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(filePath);

      const storageFile: StorageFile = {
        filename,
        originalName: filename,
        mimetype: contentType,
        size: totalSize,
        path: filePath,
        url: publicUrlData.publicUrl,
        metadata: options.metadata,
      };

      this.logger.log(
        `Stream uploaded to Supabase: ${filePath} (${totalSize} bytes)`,
      );
      return storageFile;
    } catch (error) {
      this.logger.error('Error uploading stream to Supabase:', error);
      throw error;
    }
  }

  async download(filePath: string): Promise<Buffer> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .download(filePath);

      if (error) {
        throw new Error(`Supabase download error: ${error.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(
        `Error downloading file from Supabase: ${filePath}`,
        error,
      );
      throw error;
    }
  }

  async delete(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .remove([filePath]);

      if (error) {
        this.logger.error(`Supabase delete error: ${error.message}`);
        return false;
      }

      this.logger.log(`File deleted from Supabase: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting file from Supabase: ${filePath}`,
        error,
      );
      return false;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const folderPath = pathParts.join('/');

      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .list(folderPath || '', {
          search: fileName,
        });

      if (error) {
        this.logger.error(
          `Error checking if file exists in Supabase: ${filePath}`,
          error,
        );
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      this.logger.error(
        `Error checking if file exists in Supabase: ${filePath}`,
        error,
      );
      return false;
    }
  }

  async getUrl(filePath: string): Promise<string> {
    try {
      const { data } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      this.logger.error(
        `Error generating URL for Supabase object: ${filePath}`,
        error,
      );
      throw error;
    }
  }

  async copy(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageFile> {
    try {
      // Download the source file
      const sourceBuffer = await this.download(sourcePath);

      // Upload to destination
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(destinationPath, sourceBuffer, {
          contentType: this.getMimeType(destinationPath),
        });

      if (error) {
        throw new Error(`Supabase copy error: ${error.message}`);
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(destinationPath);

      const storageFile: StorageFile = {
        filename: destinationPath.split('/').pop() || destinationPath,
        originalName: destinationPath.split('/').pop() || destinationPath,
        mimetype: this.getMimeType(destinationPath),
        size: sourceBuffer.length,
        path: destinationPath,
        url: publicUrlData.publicUrl,
      };

      this.logger.log(
        `File copied in Supabase from ${sourcePath} to ${destinationPath}`,
      );
      return storageFile;
    } catch (error) {
      this.logger.error(
        `Error copying file in Supabase from ${sourcePath} to ${destinationPath}:`,
        error,
      );
      throw error;
    }
  }

  async list(folder?: string): Promise<StorageFile[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .list(folder || '', {
          limit: 1000,
        });

      if (error) {
        this.logger.error(`Supabase list error: ${error.message}`);
        return [];
      }

      const files: StorageFile[] = [];

      for (const item of data) {
        if (item.name && !item.id) {
          // Skip folders (they have id property)
          const filePath = folder ? `${folder}/${item.name}` : item.name;
          const { data: publicUrlData } = this.supabase.storage
            .from(this.bucket)
            .getPublicUrl(filePath);

          files.push({
            filename: item.name,
            originalName: item.name,
            mimetype: this.getMimeType(item.name),
            size: item.metadata?.size || 0,
            path: filePath,
            url: publicUrlData.publicUrl,
            metadata: item.metadata,
          });
        }
      }

      return files;
    } catch (error) {
      this.logger.error(
        `Error listing files in Supabase folder: ${folder || 'root'}`,
        error,
      );
      return [];
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      avi: 'video/avi',
      mov: 'video/quicktime',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
