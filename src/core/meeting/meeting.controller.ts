import { Controller, Get, Logger, Param } from '@nestjs/common';

import { ParseCUIDPipe } from '@/common/pipes/parse-cuid.pipe';
import { MeetingService } from './meeting.service';

@Controller('meetings')
export class MeetingController {
  private readonly logger = new Logger(MeetingController.name);

  constructor(private readonly meetingService: MeetingService) {}

  @Get(':id')
  async getMeeting(@Param('id', ParseCUIDPipe) id: string) {
    this.logger.log(`Fetching meeting: ${id}`);

    return this.meetingService.getMeetingWithTranscript(id);
  }

  // TODO: Implement the get meetings by user (paginated)
}
