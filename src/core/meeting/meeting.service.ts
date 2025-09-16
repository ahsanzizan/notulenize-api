import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMeetingWithTranscript(id: string) {
    try {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id },

        include: {
          transcript: {
            include: {
              chunks: {
                orderBy: { chunkIndex: 'asc' },
              },
            },
          },

          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!meeting) {
        throw new NotFoundException(`Meeting with ID ${id} not found`);
      }

      this.logger.log(`Retrieved meeting: ${id}`);

      return meeting;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error fetching meeting ${id}: ${error.message}`,
        error.stack,
      );

      throw new Error(`Failed to fetch meeting: ${error.message}`);
    }
  }
}
