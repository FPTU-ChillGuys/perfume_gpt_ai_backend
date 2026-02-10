import { Sentiment } from 'src/domain/enum/sentiment.enum';
import { CommonResponse } from './common/common.response';
import { ApiProperty } from '@nestjs/swagger';

/** Response tóm tắt đánh giá sản phẩm bởi AI */
export class AIReviewSummaryResponse extends CommonResponse {
  /** ID sản phẩm */
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  productId!: string;

  /** Nội dung tóm tắt đánh giá */
  @ApiProperty({ description: 'Nội dung tóm tắt đánh giá từ AI' })
  summary!: string;

  /** Cảm xúc chung */
  @ApiProperty({ description: 'Cảm xúc chung', enum: Sentiment })
  sentiment!: Sentiment;

  /** Số lượng đánh giá được tóm tắt */
  @ApiProperty({ description: 'Số lượng đánh giá' })
  reviewCount!: number;

  constructor(init?: Partial<AIReviewSummaryResponse>) {
    super();
    Object.assign(this, init);
  }
}
