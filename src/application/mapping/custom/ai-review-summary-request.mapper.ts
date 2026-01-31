import { ReviewSumaryRequest } from '../../dtos/request/add-review-sumary.request';
import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';

export class AIReviewSummaryRequestMapper {
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
