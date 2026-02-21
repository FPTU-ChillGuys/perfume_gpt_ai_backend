import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';
import { Sentiment } from 'src/domain/enum/sentiment.enum';

/** Request tạo bản tóm tắt đánh giá sản phẩm */
export class ReviewSumaryRequest {
  /** ID sản phẩm */
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  @IsUUID()
  productId!: string;

  /** Nội dung tóm tắt */
  @ApiProperty({ description: 'Nội dung tóm tắt đánh giá' })
  @IsString()
  @IsNotEmpty()
  summary!: string;

  /** Cảm xúc chung */
  @ApiProperty({ description: 'Cảm xúc chung', enum: Sentiment })
  @IsEnum(Sentiment)
  sentiment!: Sentiment;

  /** Số lượng đánh giá */
  @ApiProperty({ description: 'Số lượng đánh giá được tóm tắt' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  reviewCount!: number;

  constructor(init?: Partial<ReviewSumaryRequest>) {
    Object.assign(this, init);
  }
}
