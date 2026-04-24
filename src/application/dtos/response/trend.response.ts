/** Kết quả best seller */
export interface BestSellerProduct {
  id: string;
  [key: string]: unknown;
}

/** Kết quả trend analysis */
export interface TrendAnalysisResult {
  bestSellers: BestSellerProduct[];
  queryProducts: BestSellerProduct[];
  intersection: BestSellerProduct[];
}
