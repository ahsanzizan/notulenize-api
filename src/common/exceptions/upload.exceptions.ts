import { HttpException, HttpStatus } from '@nestjs/common';

export class UploadSessionNotFoundException extends HttpException {
  constructor(uploadId: string) {
    super(`Upload session with ID ${uploadId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class InvalidUploadStatusException extends HttpException {
  constructor(currentStatus: string) {
    super(
      `Cannot perform operation on upload with status: ${currentStatus}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FileProcessingException extends HttpException {
  constructor(message: string) {
    super(
      `File processing failed: ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class SupabaseUploadException extends HttpException {
  constructor(message: string) {
    super(
      `Supabase upload failed: ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
