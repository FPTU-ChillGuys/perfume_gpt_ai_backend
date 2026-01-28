import { ApiProperty } from '@nestjs/swagger';
import { Sentiment } from 'src/domain/enum/sentiment.enum';

export class ReviewSumaryRequest {
  @ApiProperty()
  productId!: string;
  @ApiProperty()
  summary!: string;
  @ApiProperty({ enum: Sentiment })
  sentiment!: Sentiment;
  @ApiProperty()
  reviewCount!: number;
}
