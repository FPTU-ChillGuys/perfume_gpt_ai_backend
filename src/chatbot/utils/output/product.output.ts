import { z } from "zod";

export const productCardVariantOutputSchema = z.object({
    id: z.string(),
    sku: z.string(),
    volumeMl: z.number(),
    basePrice: z.number()
});

export const productCardOutputItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    brandName: z.string(),
    primaryImage: z.string().nullable(),
    variants: z.array(productCardVariantOutputSchema)
});

export const productOutput = {
    schema: z.object({
        products: z.array(productCardOutputItemSchema).optional(),
        productTemp: z.object({
            ids: z.array(z.string())
        }).optional().describe('Danh sách productId tạm thời thu thập từ tool items để hệ thống tự động hydrate')
    })
};

export const productOutputSchema = productOutput.schema;
export type ProductCardVariantOutput = z.infer<typeof productCardVariantOutputSchema>;
export type ProductCardOutputItem = z.infer<typeof productCardOutputItemSchema>;
