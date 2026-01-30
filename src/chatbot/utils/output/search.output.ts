import { Output } from "ai";
import { ProductResponse } from "src/application/dtos/response/product.response";
import z from "zod";

export const searchOutput = {
  schema: z.object({
    message: z.string(),
    products : z.array(z.object(ProductResponse))
  })
}
