import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { ApiPublicErrorResponses } from 'src/application/decorators/swagger-error.decorator';
import { DictionaryBuilderService } from 'src/infrastructure/domain/common/dictionary-builder.service';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { VocabularySnapshotService } from 'src/infrastructure/domain/common/vocabulary-snapshot.service';

/**
 * Dictionary test controller - for development/testing only
 * Exposes API to inspect dictionary, parse text, and validate winkNLP integration
 */
@Public()
@ApiTags('Dictionary')
@ApiExtraModels()
@ApiPublicErrorResponses()
@Controller('api/v1/dictionary')
export class DictionaryController {
  private readonly logger = new Logger(DictionaryController.name);

  constructor(
    private readonly dictionarybuilderService: DictionaryBuilderService,
    private readonly nlpEngineService: NlpEngineService,
    private readonly vocabularySnapshotService: VocabularySnapshotService,
  ) {}

  /**
   * GET /api/v1/dictionary/snapshot
   * Get current dictionary snapshot (canonicals, synonyms, stats)
   */
  @Get('snapshot')
  @ApiOperation({
    summary: 'Get dictionary snapshot',
    description: 'Return the current in-memory dictionary statistics and entity breakdown.',
  })
  @ApiOkResponse({
    description: 'Dictionary snapshot returned successfully',
    schema: {
      example: {
        stats: {
          totalCanonicals: 120,
          totalSynonyms: 340,
          entityBreakdown: {
            brand: { canonicals: 15, synonyms: 40 },
          },
          timestamp: '2026-04-02T10:00:00.000Z',
        },
        entityBreakdown: {
          brand: { canonicals: 15, synonyms: 40 },
        },
        message: 'Dictionary snapshot',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Dictionary is not initialized' })
  getSnapshot() {
    const snapshot = this.dictionarybuilderService.getSnapshot();
    if (!snapshot) {
      return { error: 'Dictionary not initialized' };
    }

    return {
      stats: snapshot.stats,
      entityBreakdown: snapshot.stats.entityBreakdown,
      message: 'Dictionary snapshot',
    };
  }

  /**
   * GET /api/v1/dictionary/ready
   * Check if services are initialized and ready
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Check dictionary readiness',
    description: 'Returns whether the dictionary builder and winkNLP services are initialized.',
  })
  @ApiOkResponse({
    description: 'Readiness information returned successfully',
    schema: {
      example: {
        dictionaryReady: true,
        winkNlpReady: true,
        timestamp: '2026-04-02T10:00:00.000Z',
      },
    },
  })
  checkReady() {
    return {
      dictionaryReady: this.dictionarybuilderService.getSnapshot() !== null,
      winkNlpReady: this.nlpEngineService.isReady(),
      activeNlpEngine: this.nlpEngineService.getActiveEngine(),
      timestamp: new Date(),
    };
  }

  /**
   * POST /api/v1/dictionary/parse
   * Parse text using winkNLP + normalize to canonical entities
   * Body: { text: string }
   */
  @Post('parse')
  @ApiOperation({
    summary: 'Parse and normalize text',
    description: 'Extract raw entities with winkNLP and normalize them to canonical values.',
  })
  @ApiBody({
    schema: {
      example: {
        text: 'mua giày nike air màu đen',
      },
    },
  })
  @ApiOkResponse({
    description: 'Text parsed successfully',
    schema: {
      example: {
        input: 'mua giày nike air màu đen',
        rawEntities: [
          { value: 'giày', type: 'product_name' },
          { value: 'nike air', type: 'brand' },
        ],
        normalized: {
          product_name: [
            {
              raw: 'giày',
              canonical: 'giày',
              confidence: 1,
              type: 'product_name',
            },
          ],
          brand: [
            {
              raw: 'nike air',
              canonical: 'nike',
              confidence: 0.95,
              type: 'brand',
            },
          ],
        },
        byType: {
          product_name: ['giày'],
          brand: ['nike'],
        },
        message: 'Parse successful',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing text field or parsing failed' })
  parseText(@Body() body: { text: string }) {
    if (!body.text) {
      return { error: 'text field is required' };
    }

    try {
      const result = this.nlpEngineService.parseAndNormalize(body.text);
      return {
        input: body.text,
        ...result,
        message: 'Parse successful',
      };
    } catch (error) {
      this.logger.error(`Parse failed: ${error}`);
      return {
        error: `Parse failed: ${error}`,
      };
    }
  }

  /**
   * POST /api/v1/dictionary/extract-entities
   * Extract raw entities using winkNLP (no normalization)
   * Body: { text: string }
   */
  @Post('extract-entities')
  @ApiOperation({
    summary: 'Extract raw entities',
    description: 'Extract custom entities using winkNLP without canonical normalization.',
  })
  @ApiBody({
    schema: {
      example: {
        text: 'mua giày nike air màu đen',
      },
    },
  })
  @ApiOkResponse({
    description: 'Entities extracted successfully',
    schema: {
      example: {
        input: 'mua giày nike air màu đen',
        rawEntities: [
          { value: 'giày', type: 'product_name' },
          { value: 'nike air', type: 'brand' },
        ],
        count: 2,
        message: 'Entity extraction successful',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing text field or extraction failed' })
  extractEntities(@Body() body: { text: string }) {
    if (!body.text) {
      return { error: 'text field is required' };
    }

    try {
      const entities = this.nlpEngineService.extractEntities(body.text);
      return {
        input: body.text,
        rawEntities: entities,
        count: entities.length,
        message: 'Entity extraction successful',
      };
    } catch (error) {
      this.logger.error(`Entity extraction failed: ${error}`);
      return {
        error: `Entity extraction failed: ${error}`,
      };
    }
  }

  /**
   * GET /api/v1/dictionary/entity-types
   * List all available entity types in dictionary
   */
  @Get('entity-types')
  @ApiOperation({
    summary: 'List dictionary entity types',
    description: 'Return all entity types currently registered in the dictionary.',
  })
  @ApiOkResponse({
    description: 'Entity types returned successfully',
    schema: {
      example: {
        entityTypes: [
          'brand',
          'category',
          'concentration',
          'olfactory_family',
          'scent_note',
          'attribute_category',
          'attribute_value',
          'product_name',
          'gender',
          'origin',
          'variant_type',
          'note_type',
        ],
        count: 12,
      },
    },
  })
  getEntityTypes() {
    const snapshot = this.dictionarybuilderService.getSnapshot();
    if (!snapshot) {
      return { error: 'Dictionary not initialized' };
    }

    const types = Object.keys(snapshot.stats.entityBreakdown);
    return {
      entityTypes: types,
      count: types.length,
    };
  }

  /**
   * POST /api/v1/dictionary/rebuild
   * Manually rebuild dictionary (dev/testing only)
   */
  @Post('rebuild')
  @ApiOperation({
    summary: 'Rebuild dictionary',
    description: 'Force rebuild the dictionary from master data and reinitialize winkNLP.',
  })
  @ApiOkResponse({
    description: 'Dictionary rebuilt successfully',
    schema: {
      example: {
        success: true,
        stats: {
          totalCanonicals: 120,
          totalSynonyms: 340,
          entityBreakdown: {
            brand: { canonicals: 15, synonyms: 40 },
          },
          timestamp: '2026-04-02T10:00:00.000Z',
        },
        message: 'Dictionary rebuilt successfully',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Dictionary rebuild failed' })
  async rebuildDictionary() {
    try {
      const snapshot = await this.dictionarybuilderService.buildDictionary();
      await this.vocabularySnapshotService.persistSnapshot(snapshot, 'manual-rebuild');
      const reloadedSnapshot = await this.vocabularySnapshotService.loadActiveSnapshot();
      if (reloadedSnapshot) {
        this.dictionarybuilderService.hydrateSnapshot(reloadedSnapshot);
      }
      await this.nlpEngineService.initializeWithDictionary();
      return {
        success: true,
        stats: reloadedSnapshot?.stats ?? snapshot.stats,
        message: `Dictionary rebuilt successfully (engine: ${this.nlpEngineService.getActiveEngine()})`,
      };
    } catch (error) {
      this.logger.error(`Rebuild failed: ${error}`);
      return {
        success: false,
        error: `Rebuild failed: ${error}`,
      };
    }
  }
}
