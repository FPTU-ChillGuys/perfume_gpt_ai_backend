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
