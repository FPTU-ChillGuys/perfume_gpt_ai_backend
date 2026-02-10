import { ApiProperty } from '@nestjs/swagger';
import { Sentiment } from 'src/domain/enum/sentiment.enum';

/** Request tạo bản tóm tắt đánh giá sản phẩm */
export class ReviewSumaryRequest {
  /** ID sản phẩm */
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  productId!: string;

  /** Nội dung tóm tắt */
  @ApiProperty({ description: 'Nội dung tóm tắt đánh giá' })
  summary!: string;

  /** Cảm xúc chung */
  @ApiProperty({ description: 'Cảm xúc chung', enum: Sentiment })
  sentiment!: Sentiment;

  /** Số lượng đánh giá */
  @ApiProperty({ description: 'Số lượng đánh giá được tóm tắt' })
  reviewCount!: number;

  constructor(init?: Partial<ReviewSumaryRequest>) {
    Object.assign(this, init);
  }
}
