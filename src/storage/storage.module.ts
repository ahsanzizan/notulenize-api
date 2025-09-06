import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocalStorageService } from './services/local-storage.service';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { StorageFactory } from './storage.factory';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [StorageFactory, LocalStorageService, SupabaseStorageService],
  exports: [StorageFactory],
})
export class StorageModule {}
