import { Sentiment } from '../enum/sentiment.enum';
import { Common } from './common/common.entities';

export class AIReviewSummary extends Common {
  productId!: string;
  summary!: string;
  sentiment!: Sentiment;
  reviewCount!: number;
}
