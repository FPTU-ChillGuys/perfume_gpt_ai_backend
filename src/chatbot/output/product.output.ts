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

export const productTempItemSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    variants: z.array(z.object({ id: z.string(), price: z.number() })).nullable()
});

export const productOutput = {
    schema: z.object({
        products: z.array(productCardOutputItemSchema).nullable(),
        productTemp: z.array(productTempItemSchema).nullable()
    }).describe('Danh sách sản phẩm (id, name) và các biến thể (id, price) đi kèm để hệ thống tự động hydrate')
};

export const productOutputSchema = productOutput.schema;
export type ProductCardVariantOutput = z.infer<typeof productCardVariantOutputSchema>;
export type ProductCardOutputItem = z.infer<typeof productCardOutputItemSchema>;
