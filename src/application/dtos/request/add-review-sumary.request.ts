import { Sentiment } from 'src/domain/enum/sentiment.enum';

export class ReviewSumaryRequest {
  productId!: string;
  summary!: string;
  sentiment!: Sentiment;
  reviewCount!: number;
}
