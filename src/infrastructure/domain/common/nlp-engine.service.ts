import { Injectable, Logger } from '@nestjs/common';
import { NaturalNlpService } from './natural-nlp.service';
import { WinkNlpService } from './wink-nlp.service';

@Injectable()
export class NlpEngineService {
  private readonly logger = new Logger(NlpEngineService.name);
  private activeEngine: 'wink' | 'natural' = 'natural';

  constructor(
    private readonly winkNlpService: WinkNlpService,
    private readonly naturalNlpService: NaturalNlpService,
  ) {}

  async initializeWithDictionary(): Promise<void> {
    const preferred = (process.env.NLP_ENGINE || 'natural').toLowerCase() === 'wink' ? 'wink' : 'natural';

    if (preferred === 'wink') {
      try {
        await this.winkNlpService.initializeWithDictionary();
        this.activeEngine = 'wink';
        this.logger.log('[NLP] Active engine: wink');
        return;
      } catch (error) {
        this.logger.warn(`[NLP] Wink init failed, fallback to natural: ${String(error)}`);
      }
    }

    await this.naturalNlpService.initializeWithDictionary();
    this.activeEngine = 'natural';
    this.logger.log('[NLP] Active engine: natural');
  }

  getActiveEngine(): 'wink' | 'natural' {
    return this.activeEngine;
  }

  isReady(): boolean {
    return this.getActiveService().isReady();
  }

  extractEntities(text: string): any[] {
    return this.getActiveService().extractEntities(text);
  }

  parseAndNormalize(text: string): Record<string, any> {
    return this.getActiveService().parseAndNormalize(text);
  }

  private getActiveService(): Pick<WinkNlpService, 'isReady' | 'extractEntities' | 'parseAndNormalize'> | Pick<NaturalNlpService, 'isReady' | 'extractEntities' | 'parseAndNormalize'> {
    return this.activeEngine === 'wink' ? this.winkNlpService : this.naturalNlpService;
  }
}
