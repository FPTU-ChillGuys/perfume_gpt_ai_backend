import { Injectable } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import * as z from 'zod';

@Injectable()
export class ProductTool {
  constructor(private readonly productService: ProductService) {}

  getAllProducts: Tool = tool({
    description: 'Get a list of all products available in the store.',
    inputSchema: z.object({
      pageNumber: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(10),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
      isDescending: z.boolean().optional().default(false)
    }),
    execute: async (input) => {
      const products = await this.productService.getAllProducts({
        PageNumber: input.pageNumber,
        PageSize: input.pageSize,
        SortBy: input.sortBy || '',
        SortOrder: input.sortOrder,
        IsDescending: input.isDescending
      });
      return JSON.stringify(products);
    }
  });
}
