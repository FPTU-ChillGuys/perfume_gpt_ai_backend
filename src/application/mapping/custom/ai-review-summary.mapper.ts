import { ReviewSummaryLog } from 'src/domain/entities/review-summary-log.entity';
import { AIReviewSummaryResponse } from '../../dtos/response/ai-review-summary.response';
import { ReviewSumaryRequest } from 'src/application/dtos/request/review-sumary.request';

export class ReviewSummaryLogMapper {
  static toResponse(entity: ReviewSummaryLog): AIReviewSummaryResponse {
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

  static toResponseList(entities: ReviewSummaryLog[]): AIReviewSummaryResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }

    static toEntity(request: ReviewSumaryRequest): ReviewSummaryLog {
    return new ReviewSummaryLog({
      productId: request.productId,
      summary: request.summary,
      sentiment: request.sentiment,
      reviewCount: request.reviewCount
    });
  }

  static toEntityList(requests: ReviewSumaryRequest[]): ReviewSummaryLog[] {
    return requests.map((request) => this.toEntity(request));
  }
}
