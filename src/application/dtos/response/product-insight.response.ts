import { ProductWithVariantsResponse } from './product-with-variants.response';

export class BestSellingProductResponse {
  product!: ProductWithVariantsResponse;
  totalSoldQuantity!: number;
}