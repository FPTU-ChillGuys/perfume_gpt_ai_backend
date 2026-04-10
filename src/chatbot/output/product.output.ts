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
    variants: z.array(productCardVariantOutputSchema),
    reasoning: z.string().nullable().describe('Giải thích lý do lựa chọn sản phẩm này cho người dùng dựa trên nhu cầu của họ.'),
    source: z.string().nullable().describe('Nguồn gợi ý sản phẩm (ví dụ: RECOMMENDATION_RESULTS, SEARCH_RESULTS, vv.)')
});

export const productTempItemSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    variants: z.array(z.object({ id: z.string(), price: z.number() })).nullable(),
    reasoning: z.string().describe('Giải thích chi tiết tại sao AI quyết định gợi ý sản phẩm này (dựa trên sở thích, profile người dùng). BẮT BUỘC có.'),
    source: z.string().describe('Nguồn cung cấp sản phẩm này (RECOMMENDATION_RESULTS, SEARCH_RESULTS, hay AI_KNOWLEDGE). BẮT BUỘC có.')
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
