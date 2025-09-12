import {
  Body,
  Controller,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CompleteUploadDto,
  InitUploadDto,
  UploadPartDto,
} from './dto/upload.dto';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('init')
  async initUpload(@Body(ValidationPipe) dto: InitUploadDto, @Req() req: any) {
    this.logger.log(`Initializing upload for file: ${dto.filename}`);
    return this.uploadService.initUpload({ ...dto, userId: req.user.userId });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':uploadId/part')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadPart(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @UploadedFile() chunk: Express.Multer.File,
    @Body(ValidationPipe) dto: UploadPartDto,
  ) {
    if (!chunk) {
      throw new Error('No file chunk provided');
    }

    this.logger.log(`Uploading part ${dto.partIndex} for upload ${uploadId}`);
    return this.uploadService.uploadPart(uploadId, chunk, dto.partIndex);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':uploadId/complete')
  async completeUpload(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Body(ValidationPipe) dto: CompleteUploadDto,
  ) {
    this.logger.log(`Completing upload ${uploadId}`);
    return this.uploadService.completeUpload(uploadId, dto.title);
  }
}
