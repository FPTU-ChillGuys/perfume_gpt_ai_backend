import z from 'zod';

/** Schema Zod cho từng variant trong kết quả restock */
export const restockVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  productName: z.string(),
  volumeMl: z.number(),
  type: z.string(),
  basePrice: z.number(),
  status: z.string(),
  concentrationName: z.string().nullable(),
  totalQuantity: z.number(),
  reservedQuantity: z.number(),
  averageDailySales: z.number(),
  suggestedRestockQuantity: z.number(),
  slowStockRisk: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']).nullable()
});

/** Schema Zod cho toàn bộ output restock (array các variant) */
export const restockOutputSchema = z.object({
  variants: z.array(restockVariantSchema)
});

export type RestockVariant = z.infer<typeof restockVariantSchema>;
export type RestockOutput = z.infer<typeof restockOutputSchema>;

/** Output object dùng để truyền vào textGenerateFromPrompt */
export const restockOutput = {
  schema: restockOutputSchema
};
