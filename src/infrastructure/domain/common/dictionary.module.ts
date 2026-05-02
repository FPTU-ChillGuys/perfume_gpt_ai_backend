import { Module, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { NaturalNlpService } from './natural-nlp.service';
import { NlpEngineService } from './nlp-engine.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { VocabularySnapshotService } from './vocabulary-snapshot.service';
import { AliasPatternsHelper } from './helpers/alias-patterns.helper';
import { AliasNgramHelper } from './helpers/alias-ngram.helper';
import { AliasAiEnrichmentProcessor } from './alias-ai-enrichment.processor';
import { VocabBm25SearchService } from './vocab-bm25.service';
import { PrismaMasterDataRepository } from 'src/infrastructure/domain/repositories/prisma-master-data.repository';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    DictionaryBuilderService,
    NaturalNlpService,
    NlpEngineService,
    VocabularySnapshotService,
    AliasPatternsHelper,
    AliasNgramHelper,
    AliasAiEnrichmentProcessor,
    VocabBm25SearchService,
    PrismaMasterDataRepository
  ],
  exports: [
    DictionaryBuilderService,
    NaturalNlpService,
    NlpEngineService,
    VocabularySnapshotService,
    AliasPatternsHelper,
    AliasNgramHelper,
    VocabBm25SearchService,
    PrismaMasterDataRepository
  ]
})
export class DictionaryModule implements OnModuleInit {
  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    private readonly nlpEngineService: NlpEngineService,
    private readonly vocabularySnapshotService: VocabularySnapshotService,
    @Optional() private readonly vocabBm25SearchService?: VocabBm25SearchService
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

      if (this.vocabBm25SearchService) {
        this.vocabBm25SearchService.refreshView().catch(() => {
          console.warn(
            '[DictionaryModule] Failed to refresh vocab_search view'
          );
        });
      }
    } catch (error) {
      console.error(`[DictionaryModule] Failed to initialize: ${error}`);
    }
  }
}
