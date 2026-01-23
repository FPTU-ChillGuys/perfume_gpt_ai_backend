import { AIReviewSummaryRepository } from 'src/infrastructure/repositories/review-summary.repository';
import { Sentiment } from '../enum/sentiment.enum';
import { Common } from './common/common.entities';
import { Entity } from '@mikro-orm/core';

@Entity({ repository: () => AIReviewSummaryRepository })
export class AIReviewSummary extends Common {
  productId!: string;
  summary!: string;
  sentiment!: Sentiment;
  reviewCount!: number;
}
