import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';
import { AIReviewSummaryResponse } from '../../dtos/response/ai-review-summary.response';

export class AIReviewSummaryMapper {
  static toResponse(entity: AIReviewSummary): AIReviewSummaryResponse {
    return new AIReviewSummaryResponse({
      id: entity.id,
      productId: entity.productId,
      summary: entity.summary,
      sentiment: entity.sentiment,
      reviewCount: entity.reviewCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: AIReviewSummary[]): AIReviewSummaryResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
