import { ReviewSummaryLogRepository } from 'src/infrastructure/domain/repositories/review-summary.repository';
import { Sentiment } from '../enum/sentiment.enum';
import { Common } from './common/common.entities';
import { Entity, Enum, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu bản tóm tắt đánh giá sản phẩm do AI tạo */
@Entity({ repository: () => ReviewSummaryLogRepository })
export class ReviewSummaryLog extends Common {

  /** ID sản phẩm được tóm tắt */
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  @Property()
  productId!: string;

  /** Nội dung tóm tắt đánh giá */
  @ApiProperty({ description: 'Nội dung tóm tắt đánh giá từ AI' })
  @Property()
  summary!: string;

  /** Cảm xúc chung của đánh giá (positive / negative / neutral) */
  @ApiProperty({ description: 'Cảm xúc chung', enum: Sentiment })
  @Enum(() => Sentiment)
  sentiment!: Sentiment;

  /** Số lượng đánh giá được tóm tắt */
  @ApiProperty({ description: 'Số lượng đánh giá' })
  @Property()
  reviewCount!: number;
  
  constructor(init?: Partial<ReviewSummaryLog>) {
    super();
    Object.assign(this, init);
  }
}
