import { Module } from '@nestjs/common';
import { HybridSearchModule } from 'src/infrastructure/domain/hybrid-search/hybrid-search.module';
import { RebuildEmbeddingsController } from 'src/api/controllers/rebuild-embeddings.controller';

/**
 * RebuildEmbeddingsModule - Module cho rebuild embeddings API
 */
@Module({
  imports: [HybridSearchModule],
  controllers: [RebuildEmbeddingsController],
  providers: [],
  exports: []
})
export class RebuildEmbeddingsModule {}
