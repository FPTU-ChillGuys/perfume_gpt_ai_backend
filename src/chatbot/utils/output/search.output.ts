import { Output } from 'ai';
import z from 'zod';
import { productOutputSchema, productCardOutputItemSchema, ProductCardOutputItem } from './product.output';

export const searchOutput = {
  schema: z.object({
    message: z.string(),
    products: z.array(productCardOutputItemSchema)
  })
};

export const conversationOutput = {
  schema: z.object({
    message: z.string(),
    products: z.array(productCardOutputItemSchema),
    suggestedQuestions: z.array(z.string()).describe('Gợi ý 3-4 câu hỏi tiếp theo cho người dùng dựa trên ngữ cảnh hội thoại')
  })
};

export const trendOutput = {
  schema: z.object({
    products: z.array(productCardOutputItemSchema)
  })
};

export const searchOutputSchema = searchOutput.schema;
export const conversationOutputSchema = conversationOutput.schema;
export const trendOutputSchema = trendOutput.schema;

export const convertProductCardOutputToProducts = (output: unknown): ProductCardOutputItem[] => {
  try {
    const jsonOutput = typeof output === 'string' ? JSON.parse(output) : output;
    const parsedOutput = productOutputSchema.safeParse(jsonOutput);

    if (!parsedOutput.success) {
      console.error('[TrendProduct] Invalid structured output from AI.', parsedOutput.error.issues);
      return [];
    }

    if (!parsedOutput.data.products || parsedOutput.data.products.length === 0) {
      console.warn('[TrendProduct] AI trả về mảng products rỗng - không tìm thấy sản phẩm phù hợp.');
      return [];
    }
    return parsedOutput.data.products;
  } catch (error) {
    console.error('[TrendProduct] Lỗi parse structured output:', error);
    return [];
  }
};
