import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { NaturalNlpService } from './natural-nlp.service';
import { NlpEngineService } from './nlp-engine.service';
import { MasterDataService } from './master-data.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DictionaryController } from 'src/api/controllers/dictionary.controller';
import { VocabularySnapshotService } from './vocabulary-snapshot.service';
import { AliasPatternsHelper } from './helpers/alias-patterns.helper';
import { AliasNgramHelper } from './helpers/alias-ngram.helper';
import { AliasAiEnrichmentProcessor } from './alias-ai-enrichment.processor';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    DictionaryBuilderService,
    NaturalNlpService,
    NlpEngineService,
    MasterDataService,
    VocabularySnapshotService,
    AliasPatternsHelper,
    AliasNgramHelper,
    AliasAiEnrichmentProcessor
  ],
  controllers: [DictionaryController],
  exports: [
    DictionaryBuilderService,
    NaturalNlpService,
    NlpEngineService,
    AliasPatternsHelper,
    AliasNgramHelper
  ]
})
export class DictionaryModule implements OnModuleInit {
  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    private readonly nlpEngineService: NlpEngineService,
    private readonly vocabularySnapshotService: VocabularySnapshotService
  ) {}

  async onModuleInit() {
    try {
      console.log('[DictionaryModule] Initializing on app startup...');

      let snapshot = await this.vocabularySnapshotService.loadActiveSnapshot();

      if (snapshot) {
        this.dictionaryBuilderService.hydrateSnapshot(snapshot);
        console.log(
          '[DictionaryModule] Loaded active vocabulary snapshot from PostgreSQL'
        );
      } else {
        snapshot = await this.dictionaryBuilderService.buildDictionary();
        await this.vocabularySnapshotService.persistSnapshot(
          snapshot,
          'sqlserver-master-data'
        );
        snapshot =
          (await this.vocabularySnapshotService.loadActiveSnapshot()) ??
          snapshot;
        this.dictionaryBuilderService.hydrateSnapshot(snapshot);
        console.log(
          '[DictionaryModule] Built and persisted new vocabulary snapshot'
        );
      }

      console.log(
        `[DictionaryModule] Dictionary ready: ${snapshot.stats.totalCanonicals} canonicals, ${snapshot.stats.totalSynonyms} synonyms`
      );

      await this.nlpEngineService.initializeWithDictionary();
      console.log(
        '[DictionaryModule] NLP engine initialized and ready (natural)'
      );
    } catch (error) {
      console.error(`[DictionaryModule] Failed to initialize: ${error}`);
    }
  }
}
