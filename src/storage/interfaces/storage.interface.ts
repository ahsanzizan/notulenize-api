export interface StorageFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface UploadOptions {
  folder?: string;
  filename?: string;
  metadata?: Record<string, any>;
  public?: boolean;
}

export interface StorageService {
  upload(
    file: Express.Multer.File,
    options?: UploadOptions,
  ): Promise<StorageFile>;

  download(path: string): Promise<Buffer>;

  delete(path: string): Promise<boolean>;

  exists(path: string): Promise<boolean>;

  getUrl(path: string): Promise<string>;

  copy(sourcePath: string, destinationPath: string): Promise<StorageFile>;

  list(folder?: string): Promise<StorageFile[]>;
}

export interface StorageConfig {
  provider: 'local' | 'supabase';
  local?: {
    uploadPath: string;
    baseUrl?: string;
  };
  supabase?: {
    url: string;
    anonKey: string;
    bucket: string;
  };
}
