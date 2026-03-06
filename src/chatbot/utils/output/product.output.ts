import { z } from "zod";

export const productOutput = {
    schema: z.object({
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

export const productOutputSchema = productOutput.schema;
