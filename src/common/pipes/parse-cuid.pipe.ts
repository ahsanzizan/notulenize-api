import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isCuid } from 'cuid';

@Injectable()
export class ParseCUIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isCuid(value)) {
      throw new BadRequestException('Validation failed (CUID is expected)');
    }

    return value;
  }
}
