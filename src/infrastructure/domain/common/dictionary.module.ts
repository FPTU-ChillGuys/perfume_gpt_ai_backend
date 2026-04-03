import { Module, OnModuleInit } from '@nestjs/common';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { WinkNlpService } from './wink-nlp.service';
import { MasterDataService } from './master-data.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DictionaryController } from 'src/api/controllers/dictionary.controller';
import { VocabularySnapshotService } from './vocabulary-snapshot.service';

@Module({
  imports: [PrismaModule],
  providers: [DictionaryBuilderService, WinkNlpService, MasterDataService, VocabularySnapshotService],
  controllers: [DictionaryController],
  exports: [DictionaryBuilderService, WinkNlpService],
})
export class DictionaryModule implements OnModuleInit {
  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    private readonly winkNlpService: WinkNlpService,
    private readonly vocabularySnapshotService: VocabularySnapshotService,
  ) {}

  /**
   * Hook vào app startup để build dictionary + initialize winkNLP
   */
  async onModuleInit() {
    try {
      console.log('[DictionaryModule] Initializing on app startup...');

      const persistedSnapshot = await this.vocabularySnapshotService.loadActiveSnapshot();
      const snapshot = persistedSnapshot ?? await this.dictionaryBuilderService.buildDictionary();

      if (persistedSnapshot) {
        this.dictionaryBuilderService.hydrateSnapshot(persistedSnapshot);
        console.log('[DictionaryModule] Loaded active vocabulary snapshot from PostgreSQL');
      } else {
        await this.vocabularySnapshotService.persistSnapshot(snapshot, 'sqlserver-master-data');
        console.log('[DictionaryModule] Built and persisted new vocabulary snapshot');
      }

      console.log(`[DictionaryModule] Dictionary ready: ${snapshot.stats.totalCanonicals} canonicals, ${snapshot.stats.totalSynonyms} synonyms`);
      
      // Step 2: Initialize winkNLP with dictionary
      await this.winkNlpService.initializeWithDictionary();
      console.log(`[DictionaryModule] WinkNLP initialized and ready`);
    } catch (error) {
      console.error(`[DictionaryModule] Failed to initialize: ${error}`);
      // Don't crash app, just log warning
    }
  }
}
