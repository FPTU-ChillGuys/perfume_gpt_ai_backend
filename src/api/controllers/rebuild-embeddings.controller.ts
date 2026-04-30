import { Controller, Post, Get, Delete, Param, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from 'src/application/common/Metadata';
import { ApiAdminErrors } from 'src/application/decorators/swagger-error.decorator';
import { EmbeddingService } from 'src/infrastructure/domain/hybrid-search/embedding.service';
import { ProductEmbedding } from 'src/infrastructure/domain/hybrid-search/entities/product-embedding.entity';

/**
 * RebuildEmbeddingsController - Controller cho việc rebuild embeddings
 * Dùng để manual rebuild embeddings khi cần
 */
@ApiTags('Hybrid Search - Embeddings')
@ApiBearerAuth('jwt')
@ApiAdminErrors()
@Role(['admin'])
@Controller('hybrid-search/embeddings')
export class RebuildEmbeddingsController {
  private readonly logger = new Logger(RebuildEmbeddingsController.name);

  constructor(
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Rebuild tất cả embeddings
   * POST /hybrid-search/embeddings/rebuild
   */
  @Post('rebuild')
  @ApiOperation({ summary: 'Rebuild tất cả embeddings' })
  async rebuildAll(): Promise<{ success: number; failed: number; total: number }> {
    this.logger.log('[RebuildEmbeddings] Starting rebuild all embeddings...');
    
    const stats = await this.embeddingService.rebuildAllEmbeddings();
    
    this.logger.log(`[RebuildEmbeddings] Completed: ${stats.success} success, ${stats.failed} failed`);
    
    return {
      success: stats.success,
      failed: stats.failed,
      total: stats.success + stats.failed
    };
  }

  /**
   * Rebuild embedding cho 1 product cụ thể
   * POST /hybrid-search/embeddings/rebuild/:productId
   */
  @Post('rebuild/:productId')
  @ApiOperation({ summary: 'Rebuild embedding cho 1 product cụ thể' })
  async rebuildOne(@Param('productId') productId: string): Promise<{ success: boolean; productId: string }> {
    this.logger.log(`[RebuildEmbeddings] Rebuilding embedding for product: ${productId}`);
    
    const success = await this.embeddingService.rebuildProductEmbedding(productId);
    
    this.logger.log(`[RebuildEmbeddings] Completed for ${productId}: ${success ? 'success' : 'failed'}`);
    
    return {
      success,
      productId
    };
  }

  /**
   * Xóa embedding của 1 product
   * DELETE /hybrid-search/embeddings/:productId
   */
  @Delete(':productId')
  @ApiOperation({ summary: 'Xóa embedding của 1 product' })
  async deleteEmbedding(@Param('productId') productId: string): Promise<{ success: boolean; productId: string }> {
    try {
      await this.embeddingService.em.nativeDelete(ProductEmbedding, { productId });
      
      this.logger.log(`[RebuildEmbeddings] Deleted embedding for product: ${productId}`);
      
      return {
        success: true,
        productId
      };
    } catch (error) {
      this.logger.error(`[RebuildEmbeddings] Error deleting embedding for ${productId}:`, error);
      return {
        success: false,
        productId
      };
    }
  }

  /**
   * Get stats về embeddings
   * GET /hybrid-search/embeddings/stats
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get stats về embeddings' })
  async getStats(): Promise<{ total: number; lastRebuild?: string }> {
    const stats = await this.embeddingService.getEmbeddingsStats();
    
    return stats;
  }
}
