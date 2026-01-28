import { Sentiment } from 'src/domain/enum/sentiment.enum';
import { CommonResponse } from './common/common.response';
import { ApiProperty } from '@nestjs/swagger';

export class AIReviewSummaryResponse extends CommonResponse {
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
