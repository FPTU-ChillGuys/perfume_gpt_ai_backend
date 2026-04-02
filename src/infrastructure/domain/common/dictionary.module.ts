import { Module, OnModuleInit } from '@nestjs/common';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { WinkNlpService } from './wink-nlp.service';
import { MasterDataService } from './master-data.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DictionaryController } from 'src/api/controllers/dictionary.controller';

@Module({
  imports: [PrismaModule],
  providers: [DictionaryBuilderService, WinkNlpService, MasterDataService],
  controllers: [DictionaryController],
  exports: [DictionaryBuilderService, WinkNlpService],
})
export class DictionaryModule implements OnModuleInit {
  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    private readonly winkNlpService: WinkNlpService,
  ) {}

  /**
   * Hook vào app startup để build dictionary + initialize winkNLP
   */
  async onModuleInit() {
    try {
      console.log('[DictionaryModule] Initializing on app startup...');
      
      // Step 1: Build dictionary from master data
      const snapshot = await this.dictionaryBuilderService.buildDictionary();
      console.log(`[DictionaryModule] Dictionary built: ${snapshot.stats.totalCanonicals} canonicals, ${snapshot.stats.totalSynonyms} synonyms`);
      
      // Step 2: Initialize winkNLP with dictionary
      await this.winkNlpService.initializeWithDictionary();
      console.log(`[DictionaryModule] WinkNLP initialized and ready`);
    } catch (error) {
      console.error(`[DictionaryModule] Failed to initialize: ${error}`);
      // Don't crash app, just log warning
    }
  }
}
