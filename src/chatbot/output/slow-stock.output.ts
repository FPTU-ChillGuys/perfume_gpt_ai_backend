import z from 'zod';

export const slowStockVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  productName: z.string(),
  volumeMl: z.number(),
  type: z.string(),
  basePrice: z.number(),
  status: z.string(),
  concentrationName: z.string().nullable(),
  totalQuantity: z.number(),
  averageDailySales: z.number(),
  daysOfSupply: z.number(),
  trend: z.enum(['INCREASING', 'STABLE', 'DECLINING']),
  volatility: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  riskLevel: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
  category: z.enum(['current_slow', 'early_warning']),
  action: z.enum([
    'discontinue',
    'clearance',
    'discount',
    'monitor',
    'reduce_restock'
  ]),
  reason: z.string()
});

export const slowStockOutputSchema = z.object({
  variants: z.array(slowStockVariantSchema)
});

export type SlowStockVariant = z.infer<typeof slowStockVariantSchema>;
export type SlowStockOutput = z.infer<typeof slowStockOutputSchema>;

export const slowStockOutput = {
  schema: slowStockOutputSchema
};
