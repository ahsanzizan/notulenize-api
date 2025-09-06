import { Injectable, Logger } from '@nestjs/common';
import {
  StorageService,
  StorageFile,
  UploadOptions,
  StreamUploadOptions,
} from '../interfaces/storage.interface';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);
const stat = promisify(fs.stat);

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
    this.baseUrl = process.env.STORAGE_BASE_URL || 'http://localhost:3000';
  }

  private async initialize() {
    // Ensure upload directory exists
    await this.ensureDirectoryExists(this.uploadPath);
  }

  async upload(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<StorageFile> {
    try {
      // Initialize directories if needed
      await this.initialize();

      const folder = options.folder || 'files';
      const filename = options.filename || file.filename;
      const folderPath = path.join(this.uploadPath, folder);

      // Ensure folder exists
      await this.ensureDirectoryExists(folderPath);

      const destinationPath = path.join(folderPath, filename);
      const relativePath = path.join(folder, filename);

      // Copy file to destination
      await copyFile(file.path, destinationPath);

      // Clean up temporary file
      await unlink(file.path);

      const storageFile: StorageFile = {
        filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: relativePath,
        url: this.getPublicUrl(relativePath),
        metadata: options.metadata,
      };

      this.logger.log(`File uploaded: ${relativePath}`);
      return storageFile;
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      throw error;
    }
  }

  async uploadStream(
    stream: NodeJS.ReadableStream,
    filename: string,
    options: StreamUploadOptions = {},
  ): Promise<StorageFile> {
    try {
      // Initialize directories if needed
      await this.initialize();

      const folder = options.folder || 'files';
      const folderPath = path.join(this.uploadPath, folder);

      // Ensure folder exists
      await this.ensureDirectoryExists(folderPath);

      const destinationPath = path.join(folderPath, filename);
      const relativePath = path.join(folder, filename);

      // Create write stream and pipe input stream to it
      const writeStream = fs.createWriteStream(destinationPath);

      // Use pipeline for proper error handling and stream cleanup
      await pipeline(stream, writeStream);

      // Get file stats after upload
      const stats = await stat(destinationPath);

      const contentType = options.contentType || this.getMimeType(filename);

      const storageFile: StorageFile = {
        filename,
        originalName: filename,
        mimetype: contentType,
        size: stats.size,
        path: relativePath,
        url: this.getPublicUrl(relativePath),
        metadata: options.metadata,
      };

      this.logger.log(`Stream uploaded: ${relativePath} (${stats.size} bytes)`);
      return storageFile;
    } catch (error) {
      this.logger.error('Error uploading stream:', error);
      throw error;
    }
  }

  async download(filePath: string): Promise<Buffer> {
    try {
      const fullPath = path.join(this.uploadPath, filePath);
      return fs.readFileSync(fullPath);
    } catch (error) {
      this.logger.error(`Error downloading file ${filePath}:`, error);
      throw error;
    }
  }

  async delete(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.uploadPath, filePath);
      await unlink(fullPath);
      this.logger.log(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.uploadPath, filePath);
      await access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(filePath: string): Promise<string> {
    return this.getPublicUrl(filePath);
  }

  async copy(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageFile> {
    try {
      const sourceFullPath = path.join(this.uploadPath, sourcePath);
      const destFullPath = path.join(this.uploadPath, destinationPath);

      // Ensure destination directory exists
      const destDir = path.dirname(destFullPath);
      await this.ensureDirectoryExists(destDir);

      await copyFile(sourceFullPath, destFullPath);

      const stats = await stat(destFullPath);
      const storageFile: StorageFile = {
        filename: path.basename(destinationPath),
        originalName: path.basename(destinationPath),
        mimetype: this.getMimeType(destinationPath),
        size: stats.size,
        path: destinationPath,
        url: this.getPublicUrl(destinationPath),
      };

      this.logger.log(`File copied from ${sourcePath} to ${destinationPath}`);
      return storageFile;
    } catch (error) {
      this.logger.error(
        `Error copying file from ${sourcePath} to ${destinationPath}:`,
        error,
      );
      throw error;
    }
  }

  async list(folder?: string): Promise<StorageFile[]> {
    try {
      const folderPath = folder
        ? path.join(this.uploadPath, folder)
        : this.uploadPath;
      const files = fs.readdirSync(folderPath);

      const storageFiles: StorageFile[] = [];

      for (const filename of files) {
        const filePath = folder ? path.join(folder, filename) : filename;
        const fullPath = path.join(folderPath, filename);
        const stats = await stat(fullPath);

        // Skip directories
        if (stats.isFile()) {
          storageFiles.push({
            filename,
            originalName: filename,
            mimetype: this.getMimeType(filename),
            size: stats.size,
            path: filePath,
            url: this.getPublicUrl(filePath),
          });
        }
      }

      return storageFiles;
    } catch (error) {
      this.logger.error(`Error listing files in ${folder || 'root'}:`, error);
      return [];
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await access(dirPath, fs.constants.F_OK);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private getPublicUrl(filePath: string): string {
    return `${this.baseUrl}/uploads/${filePath.replace(/\\/g, '/')}`;
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.avi': 'video/avi',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
