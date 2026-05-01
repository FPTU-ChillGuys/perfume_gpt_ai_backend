export type RestockVariantResult = {
  id: string;
  sku: string;
  productName: string;
  volumeMl: number;
  type: string;
  basePrice: number;
  status: string;
  concentrationName: string | null;
  totalQuantity: number;
  reservedQuantity: number;
  averageDailySales: number;
  suggestedRestockQuantity: number;
  slowStockRisk?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null;
  supplierId?: number;
  supplierName?: string;
  negotiatedPrice?: number;
  estimatedLeadTimeDays?: number;
};

export type RestockLogPayload = {
  variants?: RestockVariantResult[];
};
