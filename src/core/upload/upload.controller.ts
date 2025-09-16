import { ParseCUIDPipe } from '@/common/pipes/parse-cuid.pipe';
import {
  Body,
  Controller,
  Logger,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CompleteUploadDto,
  InitUploadDto,
  UploadPartDto,
} from './dto/upload.dto';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post('init')
  async initUpload(
    @Body(ValidationPipe) dto: InitUploadDto,
    @Req() req: { user: { userId: string } },
  ) {
    this.logger.log(`Initializing upload for file: ${dto.filename}`);
    return this.uploadService.initUpload({ ...dto, userId: req.user.userId });
  }

  @Put(':uploadId/part')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadPart(
    @Param('uploadId', ParseCUIDPipe) uploadId: string,
    @UploadedFile() chunk: Express.Multer.File,
    @Body(ValidationPipe) dto: UploadPartDto,
  ) {
    if (!chunk) {
      throw new Error('No file chunk provided');
    }

    this.logger.log(`Uploading part ${dto.partIndex} for upload ${uploadId}`);
    return this.uploadService.uploadPart(uploadId, chunk, dto.partIndex);
  }

  @Post(':uploadId/complete')
  async completeUpload(
    @Param('uploadId', ParseCUIDPipe) uploadId: string,
    @Body(ValidationPipe) dto: CompleteUploadDto,
  ) {
    this.logger.log(`Completing upload ${uploadId}`);
    return this.uploadService.completeUpload(uploadId, dto.title);
  }
}
