import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueueName, ProductSyncJobName } from 'src/application/constant/processor';
import { EmbeddingService } from 'src/infrastructure/domain/hybrid-search/embedding.service';
import { VocabBm25SearchService } from 'src/infrastructure/domain/common/vocab-bm25.service';

@Processor({
  name: QueueName.INVENTORY_QUEUE
})
export class ProductSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductSyncProcessor.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vocabBm25SearchService: VocabBm25SearchService
  ) {
    super();
  }

  async process(job: Job<{ productId: string; action: string }>): Promise<void> {
    const { productId, action } = job.data;

    this.logger.log(
      `[ProductSync] Processing job: action=${action} productId=${productId} jobId=${job.id}`
    );

    try {
      switch (action) {
        case 'created':
        case 'updated':
          await this.embeddingService.rebuildProductEmbedding(productId);
          break;

        case 'deleted':
          await this.embeddingService.deleteEmbedding(productId);
          break;

        default:
          this.logger.warn(`[ProductSync] Unknown action: ${action}`);
          return;
      }

      // Refresh BM25 materialized view after any product change
      await this.vocabBm25SearchService.refreshView();

      this.logger.log(
        `[ProductSync] Completed: action=${action} productId=${productId}`
      );
    } catch (error) {
      this.logger.error(
        `[ProductSync] Failed: action=${action} productId=${productId} error=${(error as Error).message}`,
        (error as Error).stack
      );
      throw error;
    }
  }
}
