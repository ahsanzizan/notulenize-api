import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './interfaces/storage.interface';
import { LocalStorageService } from './services/local-storage.service';
import { SupabaseStorageService } from './services/supabase-storage.service';

@Injectable()
export class StorageFactory {
  private readonly logger = new Logger(StorageFactory.name);
  private storageService: StorageService;

  constructor(private readonly configService: ConfigService) {
    this.initializeStorage();
  }

  private initializeStorage() {
    const provider = this.configService.get<string>(
      'STORAGE_PROVIDER',
      'local',
    );

    switch (provider) {
      case 'local':
        this.storageService = new LocalStorageService();
        this.logger.log('Initialized LocalStorageService');
        break;
      case 'supabase':
        this.storageService = new SupabaseStorageService(this.configService);
        this.logger.log('Initialized SupabaseStorageService');
        break;
      default:
        this.logger.warn(
          `Unknown storage provider: ${provider}, falling back to local storage`,
        );
        this.storageService = new LocalStorageService();
    }
  }

  getStorageService(): StorageService {
    return this.storageService;
  }

  // Method to switch storage provider at runtime (useful for testing or configuration changes)
  switchProvider(provider: string) {
    this.logger.log(`Switching storage provider to: ${provider}`);
    this.initializeStorage();
  }
}
