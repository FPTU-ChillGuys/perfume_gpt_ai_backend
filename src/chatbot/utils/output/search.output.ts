import { Output } from 'ai';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import z from 'zod';
import { productOutputSchema } from './product.output';

export const searchOutput = {
  schema: z.object({
    message: z.string(),
    products: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        brandName: z.string(),
        categoryName: z.string(),
        primaryImage: z.string().nullable(),
        attributes: z.array(
          z.object({
            attribute: z.string(),
            value: z.string(),
            desciption: z.string().nullable()
          })
        ),
        variants: z.array(
          z.object({
            id: z.string(),
            sku: z.string(),
            volumeMl: z.number(),
            type: z.string(),
            basePrice: z.number(),
            status: z.string(),
            concentrationName: z.string().nullable(),
            totalQuantity: z.number().nullable(),
            reservedQuantity: z.number().nullable()
          })
        )
      })
    )
  })
};

export const searchOutputSchema = searchOutput.schema;

export const convertSearchOutputToProductResponse = (output: string): ProductResponse[] => {
  try {
    const parsedOutput = productOutputSchema.parse(JSON.parse(output));
    if (!parsedOutput.products || parsedOutput.products.length === 0) {
      console.warn('[TrendProduct] AI trả về mảng products rỗng - không tìm thấy sản phẩm phù hợp.');
      return [];
    }
    return parsedOutput.products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      brandName: product.brandName,
      categoryName: product.categoryName,
      primaryImage: product.primaryImage,
      attributes: product.attributes,
      variants: product.variants,
    })) as unknown as ProductResponse[];
  } catch (error) {
    console.error('[TrendProduct] Lỗi parse structured output:', error);
    return [];
  }
};
