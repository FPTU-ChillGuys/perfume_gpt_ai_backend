import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Logger,
  BadRequestException
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
  ApiBadRequestResponse,
  ApiExtraModels
} from '@nestjs/swagger';
import { Role } from 'src/application/common/Metadata';
import { ApiAdminErrors } from 'src/application/decorators/swagger-error.decorator';
import { DictionaryBuilderService } from 'src/infrastructure/domain/common/dictionary-builder.service';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { VocabularySnapshotService } from 'src/infrastructure/domain/common/vocabulary-snapshot.service';
import { VocabBm25SearchService } from 'src/infrastructure/domain/common/vocab-bm25.service';
import { EmbeddingService } from 'src/infrastructure/domain/hybrid-search/embedding.service';
import { ProductEmbedding } from 'src/infrastructure/domain/hybrid-search/entities/product-embedding.entity';
import { AddPhraseRuleRequest } from 'src/application/dtos/request/dictionary/add-phrase-rule.request';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Admin - Maintenance')
@ApiBearerAuth('jwt')
@ApiAdminErrors()
@ApiExtraModels()
@Role(['admin'])
@Controller('admin/maintenance')
export class AdminMaintenanceController {
  private readonly logger = new Logger(AdminMaintenanceController.name);

  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    private readonly nlpEngineService: NlpEngineService,
    private readonly vocabularySnapshotService: VocabularySnapshotService,
    private readonly embeddingService: EmbeddingService,
    private readonly vocabBm25SearchService: VocabBm25SearchService
  ) {}

  @Post('rebuild-all')
  @ApiOperation({ summary: 'Full rebuild: dictionary + embeddings + BM25' })
  @ApiOkResponse({ description: 'Full rebuild completed successfully' })
  async rebuildAll() {
    const startTime = Date.now();
    try {
      this.logger.log('[RebuildAll] Starting full rebuild...');

      this.logger.log('[RebuildAll] Step 1/5: Building dictionary...');
      const snapshot = await this.dictionaryBuilderService.buildDictionary();

      this.logger.log('[RebuildAll] Step 2/5: Persisting snapshot...');
      await this.vocabularySnapshotService.persistSnapshot(
        snapshot,
        'manual-rebuild-all'
      );

      this.logger.log(
        '[RebuildAll] Step 3/5: Reloading + hydrating snapshot...'
      );
      const reloadedSnapshot =
        await this.vocabularySnapshotService.loadActiveSnapshot();
      if (reloadedSnapshot) {
        this.dictionaryBuilderService.hydrateSnapshot(reloadedSnapshot);
      }
      await this.nlpEngineService.initializeWithDictionary();

      this.logger.log('[RebuildAll] Step 4/5: Refreshing BM25 view...');
      const bm25Promise = this.vocabBm25SearchService.refreshView();

      this.logger.log('[RebuildAll] Step 5/5: Rebuilding embeddings...');
      const embeddingStats = await this.embeddingService.rebuildAllEmbeddings();
      const bm25Status = await this.catchBm25Status(bm25Promise);

      const elapsed = Date.now() - startTime;
      this.logger.log(`[RebuildAll] Full rebuild completed in ${elapsed}ms`);

      return {
        success: true,
        dictionaryStats: reloadedSnapshot?.stats ?? snapshot.stats,
        embeddingStats,
        bm25Refreshed: bm25Status,
        elapsedMs: elapsed,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Rebuild all failed: ${error}`);
      return {
        success: false,
        error: `Rebuild all failed: ${error}`
      };
    }
  }

  @Post('rebuild/dictionary')
  @ApiOperation({ summary: 'Rebuild dictionary only' })
  @ApiOkResponse({ description: 'Dictionary rebuilt successfully' })
  async rebuildDictionary() {
    try {
      this.logger.log('[RebuildDictionary] Starting dictionary rebuild...');

      this.logger.log('[RebuildDictionary] Step 1/3: Building dictionary...');
      const snapshot = await this.dictionaryBuilderService.buildDictionary();

      this.logger.log('[RebuildDictionary] Step 2/3: Persisting snapshot...');
      await this.vocabularySnapshotService.persistSnapshot(
        snapshot,
        'manual-rebuild'
      );

      this.logger.log(
        '[RebuildDictionary] Step 3/3: Reloading + hydrating snapshot + initializing NLP...'
      );
      const reloadedSnapshot =
        await this.vocabularySnapshotService.loadActiveSnapshot();
      if (reloadedSnapshot) {
        this.dictionaryBuilderService.hydrateSnapshot(reloadedSnapshot);
      }
      await this.nlpEngineService.initializeWithDictionary();
      this.vocabBm25SearchService.refreshView().catch(() => {
        this.logger.warn('[AdminMaintenance] BM25 refresh failed silently');
      });

      return {
        success: true,
        stats: reloadedSnapshot?.stats ?? snapshot.stats,
        message: `Dictionary rebuilt successfully (engine: ${this.nlpEngineService.getActiveEngine()})`
      };
    } catch (error) {
      this.logger.error(`Dictionary rebuild failed: ${error}`);
      return {
        success: false,
        error: `Dictionary rebuild failed: ${error}`
      };
    }
  }

  @Post('rebuild/embeddings')
  @ApiOperation({ summary: 'Rebuild all embeddings' })
  @ApiOkResponse({ description: 'All embeddings rebuilt successfully' })
  async rebuildEmbeddings() {
    const stats = await this.embeddingService.rebuildAllEmbeddings();
    return {
      success: stats.success,
      failed: stats.failed,
      total: stats.success + stats.failed
    };
  }

  @Post('rebuild/embeddings/:productId')
  @ApiOperation({ summary: 'Rebuild embedding for a specific product' })
  @ApiOkResponse({ description: 'Product embedding rebuilt successfully' })
  async rebuildProductEmbedding(
    @Param('productId') productId: string
  ): Promise<{ success: boolean; productId: string }> {
    const success =
      await this.embeddingService.rebuildProductEmbedding(productId);
    return { success, productId };
  }

  @Delete('embeddings/:productId')
  @ApiOperation({ summary: 'Delete embedding for a specific product' })
  @ApiOkResponse({ description: 'Product embedding deleted successfully' })
  async deleteEmbedding(
    @Param('productId') productId: string
  ): Promise<{ success: boolean; productId: string }> {
    try {
      await this.embeddingService.em.nativeDelete(ProductEmbedding, {
        productId
      });
      this.logger.log(`Deleted embedding for product: ${productId}`);
      return { success: true, productId };
    } catch (error) {
      this.logger.error(`Error deleting embedding for ${productId}:`, error);
      return { success: false, productId };
    }
  }

  @Get('embeddings/stats')
  @ApiOperation({ summary: 'Get embedding statistics' })
  @ApiOkResponse({ description: 'Embedding stats returned successfully' })
  async getEmbeddingStats(): Promise<{
    total: number;
    lastRebuild?: string;
  }> {
    return this.embeddingService.getEmbeddingsStats();
  }

  @Post('parse/text')
  @ApiOperation({ summary: 'Parse and normalize text' })
  @ApiOkResponse({ description: 'Text parsed successfully' })
  @ApiBadRequestResponse({ description: 'Missing text field' })
  @ApiBody({ schema: { example: { text: 'mua giày nike air màu đen' } } })
  async parseText(@Body() body: { text: string }) {
    if (!body.text) {
      throw new BadRequestException('text field is required');
    }

    try {
      const result = await this.nlpEngineService.parseAndNormalize(body.text);
      return {
        input: body.text,
        ...result,
        message: 'Parse successful'
      };
    } catch (error) {
      this.logger.error(`Parse failed: ${error}`);
      return { error: `Parse failed: ${error}` };
    }
  }

  @Post('parse/extract-entities')
  @ApiOperation({ summary: 'Extract raw entities from text' })
  @ApiOkResponse({ description: 'Entities extracted successfully' })
  @ApiBadRequestResponse({ description: 'Missing text field' })
  @ApiBody({ schema: { example: { text: 'mua giày nike air màu đen' } } })
  extractEntities(@Body() body: { text: string }) {
    if (!body.text) {
      throw new BadRequestException('text field is required');
    }

    try {
      const entities = this.nlpEngineService.extractEntities(body.text);
      return {
        input: body.text,
        rawEntities: entities,
        count: entities.length,
        message: 'Entity extraction successful'
      };
    } catch (error) {
      this.logger.error(`Entity extraction failed: ${error}`);
      return { error: `Entity extraction failed: ${error}` };
    }
  }

  @Post('parse/add-rule')
  @ApiOperation({ summary: 'Add a new phrase rule to active dictionary' })
  @ApiOkResponse({ description: 'Phrase rule added successfully' })
  async addPhraseRule(@Body() body: AddPhraseRuleRequest) {
    const rule = await this.vocabularySnapshotService.addPhraseRule(
      body.phrase,
      body.ruleType,
      body.scope ?? 'global',
      body.confidence ?? 1
    );
    return {
      phrase: rule.phrase,
      normalizedPhrase: rule.normalizedPhrase,
      ruleType: rule.ruleType,
      scope: rule.scope,
      confidence: rule.confidence
    };
  }

  @Get('parse/rules')
  @ApiOperation({ summary: 'Get all active phrase rules' })
  @ApiOkResponse({ description: 'Phrase rules returned successfully' })
  async getAllPhraseRules() {
    return this.vocabularySnapshotService.getAllPhraseRules();
  }

  @Get('parse/template')
  @ApiOperation({ summary: 'Get phrase rules template (seed JSON)' })
  @ApiOkResponse({ description: 'Template returned successfully' })
  getParseRulesTemplate() {
    const candidates = [
      path.join(
        process.cwd(),
        'src',
        'application',
        'seeds',
        'parse-rules.seed.json'
      ),
      path.join(
        process.cwd(),
        'dist',
        'src',
        'application',
        'seeds',
        'parse-rules.seed.json'
      ),
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'application',
        'seeds',
        'parse-rules.seed.json'
      )
    ];

    const seedPath = candidates.find((p) => fs.existsSync(p));
    if (!seedPath) {
      return { error: 'parse-rules.seed.json not found' };
    }

    const content = fs.readFileSync(seedPath, 'utf8');
    return JSON.parse(content);
  }

  @Get('snapshot')
  @ApiOperation({ summary: 'Get current dictionary snapshot' })
  @ApiOkResponse({ description: 'Dictionary snapshot returned successfully' })
  getSnapshot() {
    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) {
      return { error: 'Dictionary not initialized' };
    }

    return {
      stats: snapshot.stats,
      entityBreakdown: snapshot.stats.entityBreakdown,
      message: 'Dictionary snapshot'
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check dictionary and NLP readiness' })
  @ApiOkResponse({ description: 'Readiness information returned successfully' })
  checkReady() {
    return {
      dictionaryReady: this.dictionaryBuilderService.getSnapshot() !== null,
      nlpReady: this.nlpEngineService.isReady(),
      activeNlpEngine: this.nlpEngineService.getActiveEngine(),
      bm25Ready: true,
      timestamp: new Date().toISOString()
    };
  }

  @Get('entity-types')
  @ApiOperation({ summary: 'List all dictionary entity types' })
  @ApiOkResponse({ description: 'Entity types returned successfully' })
  getEntityTypes() {
    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) {
      return { error: 'Dictionary not initialized' };
    }

    const types = Object.keys(snapshot.stats.entityBreakdown);
    return {
      entityTypes: types,
      count: types.length
    };
  }

  @Post('vocab-bm25-refresh')
  @ApiOperation({ summary: 'Refresh vocab BM25 materialized view' })
  @ApiOkResponse({ description: 'BM25 view refreshed successfully' })
  async refreshVocabBm25() {
    try {
      await this.vocabBm25SearchService.refreshView();
      return { success: true };
    } catch (error) {
      this.logger.error(`BM25 refresh failed: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  private async catchBm25Status(promise: Promise<void>): Promise<boolean> {
    try {
      await promise;
      return true;
    } catch {
      return false;
    }
  }
}
