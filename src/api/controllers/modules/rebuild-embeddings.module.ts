import { Module } from '@nestjs/common';
import { EmbeddingService } from 'src/infrastructure/domain/hybrid-search/embedding.service';
import { RebuildEmbeddingsController } from 'src/api/controllers/rebuild-embeddings.controller';

/**
 * RebuildEmbeddingsModule - Module cho rebuild embeddings API
 */
@Module({
  controllers: [RebuildEmbeddingsController],
  providers: [EmbeddingService],
  exports: [EmbeddingService]
})
export class RebuildEmbeddingsModule {}
