/**
 * DTOs for internal communication with the main backend via Redis.
 * These match the shapes returned by the .NET background services.
 */

export interface RedisInventoryStockResponse {
  variantId: string;
  variantSku: string;
  productName: string;
  volumeMl: number;
  type: string;
  basePrice: number;
  variantStatus: string;
  concentrationName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
}

export interface VariantSalesAnalyticsRedisResponse {
  variantId: string;
  sku: string;
  productName: string;
  volumeMl: number;
  type: string;
  basePrice: number;
  status: string;
  concentrationName: string | null;
  dailySales: Array<{
    date: string;
    quantitySold: number;
    revenue: number;
  }>;
}
