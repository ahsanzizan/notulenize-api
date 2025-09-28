import { Injectable, Logger } from '@nestjs/common';
import { AssemblyAI } from 'assemblyai';

@Injectable()
export class AssemblyAIService {
  private readonly logger = new Logger(AssemblyAIService.name);
  private client: AssemblyAI | null = null;

  private getClient(): AssemblyAI {
    if (this.client) return this.client;

    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing ASSEMBLYAI_API_KEY environment variable');
    }

    this.client = new AssemblyAI({ apiKey });
    this.logger.log('Initialized AssemblyAI client');
    return this.client;
  }

  async transcribeFromUrl(audioUrl: string): Promise<string> {
    const client = this.getClient();

    const transcript = await client.transcripts.transcribe({
      audio_url: audioUrl,
      speaker_labels: false,
      punctuate: true,
      format_text: true,
    });

    if (transcript.status !== 'completed') {
      const failureReason =
        (transcript as any).error ?? 'Transcription not completed';
      throw new Error(`AssemblyAI transcription failed: ${failureReason}`);
    }

    const text = transcript.text || '';
    if (!text.trim()) {
      throw new Error('AssemblyAI returned empty transcription text');
    }

    return text;
  }
}
