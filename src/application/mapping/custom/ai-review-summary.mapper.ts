import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';
import { AIReviewSummaryResponse } from '../../dtos/response/ai-review-summary.response';
import { ReviewSumaryRequest } from 'src/application/dtos/request/review-sumary.request';

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

    static toEntity(request: ReviewSumaryRequest): AIReviewSummary {
    return new AIReviewSummary({
      productId: request.productId,
      summary: request.summary,
      sentiment: request.sentiment,
      reviewCount: request.reviewCount
    });
  }

  static toEntityList(requests: ReviewSumaryRequest[]): AIReviewSummary[] {
    return requests.map((request) => this.toEntity(request));
  }
}
