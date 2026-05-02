import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { HybridSearchService } from './hybrid-search.service';
import { EmbeddingService } from './embedding.service';
import { QueryNormalizerOrchestrator } from './normalizers/orchestrator';
import { PriceNormalizer } from './normalizers/price.normalizer';
import { GenderNormalizer } from './normalizers/gender.normalizer';
import { YearNormalizer } from './normalizers/year.normalizer';
import { OriginNormalizer } from './normalizers/origin.normalizer';
import { FptEmbeddingService } from './fpt-embedding.service';

/**
 * HybridSearchModule - Module cho Hybrid Search v5
 * Kết hợp Query Layer (hard filters), Vector Layer (similarity search) và Reranking
 */
@Module({
  imports: [PrismaModule, ConfigModule, AIModule, HttpModule],
  providers: [
    HybridSearchService,
    EmbeddingService,
    FptEmbeddingService,
    QueryNormalizerOrchestrator,
    PriceNormalizer,
    GenderNormalizer,
    YearNormalizer,
    OriginNormalizer
  ],
  exports: [HybridSearchService, EmbeddingService]
})
export class HybridSearchModule {}
