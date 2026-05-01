export interface SlowStockCandidate {
  productName: string;
  variantCount: number;
  averageDailySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  salesTrend: 'INCREASING' | 'STABLE' | 'DECLINING';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  variants: SlowStockVariantCandidate[];
}

export interface SlowStockVariantCandidate {
  variantId: string;
  sku: string;
  volumeMl: number;
  basePrice: number;
  status: string;
  totalQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  averageDailySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  trend: 'INCREASING' | 'STABLE' | 'DECLINING';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
}
