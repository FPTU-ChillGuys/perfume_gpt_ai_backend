import { Module, OnModuleInit } from '@nestjs/common';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { WinkNlpService } from './wink-nlp.service';
import { NaturalNlpService } from './natural-nlp.service';
import { NlpEngineService } from './nlp-engine.service';
import { MasterDataService } from './master-data.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DictionaryController } from 'src/api/controllers/dictionary.controller';
import { VocabularySnapshotService } from './vocabulary-snapshot.service';

@Module({
  imports: [PrismaModule],
  providers: [DictionaryBuilderService, WinkNlpService, NaturalNlpService, NlpEngineService, MasterDataService, VocabularySnapshotService],
  controllers: [DictionaryController],
  exports: [DictionaryBuilderService, WinkNlpService, NaturalNlpService, NlpEngineService],
})
export class DictionaryModule implements OnModuleInit {
  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    private readonly nlpEngineService: NlpEngineService,
    private readonly vocabularySnapshotService: VocabularySnapshotService,
  ) {}

  /**
   * Hook vào app startup để build dictionary + initialize winkNLP
   */
  async onModuleInit() {
    try {
      console.log('[DictionaryModule] Initializing on app startup...');

      let snapshot = await this.vocabularySnapshotService.loadActiveSnapshot();

      if (snapshot) {
        this.dictionaryBuilderService.hydrateSnapshot(snapshot);
        console.log('[DictionaryModule] Loaded active vocabulary snapshot from PostgreSQL');
      } else {
        snapshot = await this.dictionaryBuilderService.buildDictionary();
        await this.vocabularySnapshotService.persistSnapshot(snapshot, 'sqlserver-master-data');
        snapshot = (await this.vocabularySnapshotService.loadActiveSnapshot()) ?? snapshot;
        this.dictionaryBuilderService.hydrateSnapshot(snapshot);
        console.log('[DictionaryModule] Built and persisted new vocabulary snapshot');
      }

      console.log(`[DictionaryModule] Dictionary ready: ${snapshot.stats.totalCanonicals} canonicals, ${snapshot.stats.totalSynonyms} synonyms`);
      
      // Step 2: Initialize selected NLP engine with dictionary
      await this.nlpEngineService.initializeWithDictionary();
      console.log(`[DictionaryModule] NLP engine initialized and ready (${this.nlpEngineService.getActiveEngine()})`);
    } catch (error) {
      console.error(`[DictionaryModule] Failed to initialize: ${error}`);
      // Don't crash app, just log warning
    }
  }
}
