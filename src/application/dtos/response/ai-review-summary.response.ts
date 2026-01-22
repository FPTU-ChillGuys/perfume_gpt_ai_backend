import { Sentiment } from 'src/domain/enum/sentiment.enum';
import { CommonResponse } from './common.response';

export class AIReviewSummaryResponse extends CommonResponse {
  productId!: string;
  summary!: string;
  sentiment!: Sentiment;
  reviewCount!: number;
}
