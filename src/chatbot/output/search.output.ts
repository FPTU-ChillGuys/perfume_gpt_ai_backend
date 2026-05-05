import { Output } from 'ai';
import z from 'zod';
import {
  productOutputSchema,
  productCardOutputItemSchema,
  ProductCardOutputItem,
  productTempItemSchema
} from './product.output';

export const searchOutput = {
  schema: z
    .object({
      message: z.string(),
      products: z.array(productCardOutputItemSchema).nullable(),
      productTemp: z.array(productTempItemSchema).nullable()
    })
    .describe(
      'Danh sách sản phẩm (id, name) và các biến thể (id, price) đi kèm để hệ thống tự động hydrate'
    )
};

export const conversationOutput = {
  schema: z.object({
    message: z.string(),
    products: z.array(productCardOutputItemSchema).nullable(),
    productTemp: z.array(productTempItemSchema).nullable(),
    suggestedQuestions: z
      .array(z.string())
      .describe(
        'Gợi ý 3-4 câu hỏi tiếp theo cho người dùng dựa trên ngữ cảnh hội thoại'
      ),
    needsReanalysis: z
      .boolean()
      .describe(
        'BẮT BUỘC luôn có. Đặt true nếu SEARCH_RESULTS hoàn toàn không liên quan đến yêu cầu người dùng (sai giới tính, sai thương hiệu, v.v.). Hệ thống sẽ phân tích lại 1 lần duy nhất. Đặt false trong mọi trường hợp khác.'
      )
  })
};

export const trendOutput = {
  schema: z
    .object({
      products: z.array(productCardOutputItemSchema).nullable(),
      productTemp: z.array(productTempItemSchema).nullable()
    })
    .describe(
      'Danh sách sản phẩm (id, name) và các biến thể (id, price) đi kèm để hệ thống tự động hydrate'
    )
};

export const surveyOutput = {
  schema: z
    .object({
      message: z
        .string()
        .describe(
          'Thông điệp tư vấn cá nhân hóa gửi cho người dùng dựa trên kết quả khảo sát (Tiếng Việt)'
        ),
      products: z
        .array(productCardOutputItemSchema)
        .nullable()
        .describe('BẮT BUỘC ĐỂ TRỐNG [].'),
      productTemp: z
        .array(productTempItemSchema)
        .nullable()
        .describe(
          'BẮT BUỘC ĐIỀN: Danh sách sản phẩm (id, name) và các biến thể (id, price) đi kèm để hệ thống tự động hydrate'
        )
    })
    .describe(
      'Kết quả tư vấn khảo sát dựa trên phân tích sở thích người dùng. AI PHẢI dùng productTemp và để products là []'
    )
};

export const searchOutputSchema = searchOutput.schema;
export const conversationOutputSchema = conversationOutput.schema;
export const trendOutputSchema = trendOutput.schema;
export const surveyOutputSchema = surveyOutput.schema;

export const convertProductCardOutputToProducts = (
  output: unknown
): ProductCardOutputItem[] => {
  try {
    const jsonOutput = typeof output === 'string' ? JSON.parse(output) : output;
    const parsedOutput = productOutputSchema.safeParse(jsonOutput);

    if (!parsedOutput.success) {
      console.error(
        '[TrendProduct] Invalid structured output from AI.',
        parsedOutput.error.issues
      );
      return [];
    }

    if (
      !parsedOutput.data.products ||
      parsedOutput.data.products.length === 0
    ) {
      console.warn(
        '[TrendProduct] AI trả về mảng products rỗng - không tìm thấy sản phẩm phù hợp.'
      );
      return [];
    }
    return parsedOutput.data.products;
  } catch (error) {
    console.error('[TrendProduct] Lỗi parse structured output:', error);
    return [];
  }
};
