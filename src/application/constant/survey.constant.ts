import { z } from 'zod';

export const SURVEY_DEFAULT_REASONING = 'Sản phẩm phù hợp với sở thích của bạn';

export const SURVEY_PRODUCT_INTRO =
  'Dựa trên khảo sát, chúng tôi gợi ý {count} sản phẩm phù hợp với bạn:';

export const v5ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  brandName: z.string(),
  primaryImage: z.string(),
  reasoning: z.string(),
  variants: z
    .array(
      z.object({
        basePrice: z.number().optional()
      })
    )
    .optional()
});

export const v5ResponseSchema = z.object({
  message: z.string().optional(),
  products: z.array(v5ProductSchema).optional()
});
