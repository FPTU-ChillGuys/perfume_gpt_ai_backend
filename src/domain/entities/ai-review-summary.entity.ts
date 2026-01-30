import { AIReviewSummaryRepository } from 'src/infrastructure/repositories/review-summary.repository';
import { Sentiment } from '../enum/sentiment.enum';
import { Common } from './common/common.entities';
import { Entity, Enum, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ repository: () => AIReviewSummaryRepository })
export class AIReviewSummary extends Common {

  @ApiProperty()
  @Property()
  productId!: string;

  @ApiProperty()
  @Property()
  summary!: string;
  @Enum(() => Sentiment)
  sentiment!: Sentiment;

  @ApiProperty()
  @Property()
  reviewCount!: number;
  constructor(init?: Partial<AIReviewSummary>) {
    super();
    Object.assign(this, init);
  }
}
