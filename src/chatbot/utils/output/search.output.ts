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
        familyName: z.string().nullable(),
        topNotes: z.string(),
        middleNotes: z.string(),
        baseNotes: z.string()
      })
    )
  })
};
