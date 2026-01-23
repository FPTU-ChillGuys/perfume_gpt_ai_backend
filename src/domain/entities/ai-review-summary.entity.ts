import { AIReviewSummaryRepository } from 'src/infrastructure/repositories/review-summary.repository';
import { Sentiment } from '../enum/sentiment.enum';
import { Common } from './common/common.entities';
import { Entity, Property } from '@mikro-orm/core';

@Entity({ repository: () => AIReviewSummaryRepository })
export class AIReviewSummary extends Common {
  @Property()
  productId!: string;
  @Property()
  summary!: string;
  @Property()
  sentiment!: Sentiment;
  @Property()
  reviewCount!: number;
}
