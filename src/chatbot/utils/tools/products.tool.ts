import { Injectable } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
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
      return await funcHandlerAsync(
        async () => {
          const response = await this.productService.getAllProducts({
            PageNumber: input.pageNumber,
            PageSize: input.pageSize,
            SortBy: input.sortBy || '',
            SortOrder: input.sortOrder,
            IsDescending: input.isDescending
          });
          console.log('ProductTool response:', response.payload?.items);
          if (!response.success) {
            return { success: false, error: 'Failed to fetch products.' };
          }
          return { success: true, data: response.payload?.items || [] };
        },
        'Error occurred while fetching products.',
        true
      );
    }
  });

  searchProduct: Tool = tool({
    description: 'Get a list of all products available in the store.',
    inputSchema: z.object({
      searches: z.array(
        z.object({
          searchText: z.string(),
          pageNumber: z.number().min(1).optional().default(1),
          pageSize: z.number().min(1).max(100).optional().default(10),
          sortBy: z.string().optional(),
          sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
          isDescending: z.boolean().optional().default(false),
          searchTerms: z.array(z.string()).optional().default([])
        })
      )
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
            // Tạo array search để search nhiều từ khóa đê tổng hợp 
          let results : ProductResponse[] = [];

          for (const item of input.searches) {
            const response = await this.productService.getProductsUsingSemanticSearch(
              item.searchText,
              {
                PageNumber: item.pageNumber,
                PageSize: item.pageSize,
                SortBy: item.sortBy || '',
                SortOrder: item.sortOrder,
                IsDescending: item.isDescending
              }
            );
            if (response.success && response.payload?.items) {
              results = results.concat(response.payload.items ?? []);
            }
          }

          return { success: true, data: results || [] };
        },
        'Error occurred while fetching products.',
        true
      );
    }
  });
}
