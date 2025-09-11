import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class InitUploadDto {
  @IsString()
  filename: string;

  @IsString()
  @IsIn([
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'video/mp4',
    'video/avi',
    'video/mov',
  ])
  fileType: string;

  @IsNumber()
  @Min(1)
  @Max(1000)
  totalParts: number;

  @IsUUID()
  userId: string;
}

export class UploadPartDto {
  @IsNumber()
  @Min(0)
  partIndex: number;
}

export class CompleteUploadDto {
  @IsString()
  @IsOptional()
  title: string;
}
