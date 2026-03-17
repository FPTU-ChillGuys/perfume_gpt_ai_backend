import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { productDetailTabsContent } from 'src/application/constant/productDetailTabContent';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class ProductTool {
  private readonly logger = new Logger(ProductTool.name);

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
      this.logger.log(`[getAllProducts] called`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.productService.getAllProductsWithVariants(
            {
              PageNumber: input.pageNumber,
              PageSize: input.pageSize,
              // SortBy: input.sortBy || '',
              SortOrder: input.sortOrder,
              IsDescending: input.isDescending
            }
          );
          this.logger.debug(`[getAllProducts] response items count: ${response.data?.items?.length ?? 0}`);
          if (!response.success) {
            return { success: false, error: 'Failed to fetch products.' };
          }
          return { success: true, data: response.data?.items || [] };
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
          this.logger.log(`[searchProduct] called with ${input.searches.length} search(es)`);
          // Tạo array search để search nhiều từ khóa đê tổng hợp
          let results: ProductWithVariantsResponse[] = [];

          for (const item of input.searches) {
            const response =
              await this.productService.getProductsUsingSemanticSearch(
                item.searchText,
                {
                  PageNumber: item.pageNumber,
                  PageSize: item.pageSize,
                  // SortBy: item.sortBy || '',
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

  getNewestProducts: Tool = tool({
    description: 'Get the newest products sorted by creation time descending.',
    inputSchema: z.object({
      pageNumber: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(10)
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          this.logger.log(`[getNewestProducts] called`);

          const response =
            await this.productService.getNewestProductsWithVariants({
              PageNumber: input.pageNumber,
              PageSize: input.pageSize,
              SortOrder: 'desc',
              IsDescending: true
            });

          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch newest products.'
            };
          }

          return { success: true, data: response.data?.items || [] };
        },
        'Error occurred while fetching newest products.',
        true
      );
    }
  });

  getBestSellingProducts: Tool = tool({
    description: 'Get the best-selling products ranked by total sold quantity.',
    inputSchema: z.object({
      pageNumber: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(10)
    }),
    execute: async (input) => {
      this.logger.log(`[getBestSellingProducts] called`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.productService.getBestSellingProducts({
            PageNumber: input.pageNumber,
            PageSize: input.pageSize,
            SortOrder: 'desc',
            IsDescending: true
          });

          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch best-selling products.'
            };
          }

          return { success: true, data: response.data?.items || [] };
        },
        'Error occurred while fetching best-selling products.',
        true
      );
    }
  });

  productDetailTabContent: Tool = tool({
    description:
      'Get detailed information about a product, including its variants, specifications, and reviews.',
    inputSchema: z.object({
      content: z.enum(['usageAndStorage', 'shippingAndReturn'])
    }),
    execute: async ({ content }) => {
      this.logger.log(`[productDetailTabContent] called with content: ${content}`);
      return productDetailTabsContent[content];
    }
  });
}
