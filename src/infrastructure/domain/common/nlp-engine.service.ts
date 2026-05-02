import { Injectable, Logger } from '@nestjs/common';
import { NaturalNlpService } from './natural-nlp.service';

@Injectable()
export class NlpEngineService {
  private readonly logger = new Logger(NlpEngineService.name);

  constructor(private readonly naturalNlpService: NaturalNlpService) {}

  async initializeWithDictionary(): Promise<void> {
    await this.naturalNlpService.initializeWithDictionary();
    this.logger.log('[NLP] Active engine: natural');
  }

  getActiveEngine(): 'natural' {
    return 'natural';
  }

  isReady(): boolean {
    return this.naturalNlpService.isReady();
  }

  extractEntities(text: string): string[] {
    return this.naturalNlpService.extractEntities(text);
  }

  async parseAndNormalize(text: string): Promise<Record<string, any>> {
    return await this.naturalNlpService.parseAndNormalize(text);
  }
}
