import { Sentiment } from 'src/domain/enum/sentiment.enum';
import { CommonResponse } from './common/common.response';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@mikro-orm/core';

export class AIReviewSummaryResponse extends BaseEntity {
  @ApiProperty()
  productId!: string;
  @ApiProperty()
  summary!: string;
  @ApiProperty()
  sentiment!: Sentiment;
  @ApiProperty()
  reviewCount!: number;

  constructor(init?: Partial<AIReviewSummaryResponse>) {
    super();
    Object.assign(this, init);
  }
}
