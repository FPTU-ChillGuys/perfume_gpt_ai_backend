export type CandidateMode = 'trend' | 'restock';

export interface ProductVariantSalesCandidate {
  variantId: string;
  sku: string;
  volumeMl: number;
  basePrice: number;
  status: string;
  isCriticalStock: boolean;
  totalQuantitySold: number;
  averageDailySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  trend: 'INCREASING' | 'STABLE' | 'DECLINING';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ProductSalesAnalyticsCandidate {
  productName: string;
  variantCount: number;
  hasCriticalStock: boolean;
  totalQuantitySold: number;
  averageDailySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  salesTrend: 'INCREASING' | 'STABLE' | 'DECLINING';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  variants: ProductVariantSalesCandidate[];
}