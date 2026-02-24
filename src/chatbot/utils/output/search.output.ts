import { Output } from 'ai';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import z from 'zod';

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
        )
      })
    )
  })
};

export const searchOutputSchema = searchOutput.schema;

export const convertSearchOutputToProductResponse = (output: string) => {
  const parsedOutput = searchOutputSchema.parse(JSON.parse(output));
  return parsedOutput.products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    brandName: product.brandName,
    categoryName: product.categoryName,
    primaryImage: product.primaryImage,
  })) as ProductResponse[]
};
