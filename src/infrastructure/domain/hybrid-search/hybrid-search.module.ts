import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { HybridSearchService } from './hybrid-search.service';
import { EmbeddingService } from './embedding.service';
import { QueryNormalizerOrchestrator } from './normalizers/orchestrator';
import { PriceNormalizer } from './normalizers/price.normalizer';
import { GenderNormalizer } from './normalizers/gender.normalizer';
import { YearNormalizer } from './normalizers/year.normalizer';
import { OriginNormalizer } from './normalizers/origin.normalizer';
import { FptEmbeddingService } from './fpt-embedding.service';

/**
 * HybridSearchModule - Module cho Hybrid Search v4
 * Kết hợp Query Layer (hard filters) và Vector Layer (similarity search)
 */
@Module({
  imports: [PrismaModule, ConfigModule, HttpModule],
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
export class HybridSearchModule { }
