import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { productDetailTabsContent } from 'src/application/constant/productDetailTabContent';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class ProductTool {
  private readonly logger = new Logger(ProductTool.name);

  constructor(
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
    private readonly err: I18nErrorHandler
  ) {}

  private mapToMinimalProduct(product: any) {
    return {
      id: product.id,
      name: product.name,
      brandName: product.brandName,
      categoryName: product.categoryName
    };
  }

  getAllProducts: Tool = tool({
    description:
      'Get a list of all products available in the store. ' +
      'Large product lists are TOON-compressed to optimize token usage.',
    inputSchema: z.object({
      pageNumber: z.number().min(1),
      pageSize: z.number().min(1).max(100),
      sortBy: z.string().nullable(),
      sortOrder: z.enum(['asc', 'desc']),
      isDescending: z.boolean()
    }),
    execute: async (input) => {
      this.logger.log(`[getAllProducts] called`);
      return await this.err.wrap(async () => {
        const response = await this.productService.getAllProductsWithVariants({
          PageNumber: input.pageNumber,
          PageSize: input.pageSize,
          SortOrder: input.sortOrder,
          IsDescending: input.isDescending
        });
        this.logger.debug(
          `[getAllProducts] response items count: ${response.data?.items?.length ?? 0}`
        );
        if (!response.success) {
          return { success: false, error: 'Failed to fetch products.' };
        }

        const items = response.data?.items || [];
        const minimalItems = items.map(this.mapToMinimalProduct);

        if (minimalItems.length > 5) {
          const encodingResult = encodeToolOutput(minimalItems);
          return {
            success: true,
            encodedData: encodingResult.encoded
          };
        }

        return { success: true, data: minimalItems };
      }, 'errors.product.tool_fetch');
    }
  });

  searchProduct: Tool = tool({
    description:
      'Search and get a list of products from the store. ' +
      'Large result sets are TOON-compressed to optimize token usage.',
    inputSchema: z.object({
      searches: z.array(
        z.object({
          searchText: z.string(),
          pageNumber: z.number().min(1),
          pageSize: z.number().min(1).max(100),
          sortBy: z.string().nullable(),
          sortOrder: z.enum(['asc', 'desc']),
          isDescending: z.boolean(),
          searchTerms: z.array(z.string())
        })
      )
    }),
    execute: async (input) => {
      return await this.err.wrap(async () => {
        this.logger.log(
          `[searchProduct] called with ${input.searches.length} search(es)`
        );
        let results: ProductWithVariantsResponse[] = [];

        for (const item of input.searches) {
          const response = await this.productService.getProductsUsingAiSearch(
            item.searchText,
            {
              PageNumber: item.pageNumber,
              PageSize: item.pageSize,
              SortOrder: item.sortOrder,
              IsDescending: item.isDescending
            }
          );
          if (response.success && response.payload?.items) {
            results = results.concat(response.payload.items ?? []);
          }
        }

        const minimalResults = results.map(this.mapToMinimalProduct);

        if (minimalResults.length > 5) {
          const encodingResult = encodeToolOutput(minimalResults);
          return {
            success: true,
            encodedData: encodingResult.encoded
          };
        }

        return { success: true, data: minimalResults || [] };
      }, 'errors.product.tool_fetch');
    }
  });

  getNewestProducts: Tool = tool({
    description:
      'Get the newest products sorted by creation time descending. Results are TOON-encoded.',
    inputSchema: z.object({
      pageNumber: z.number().min(1),
      pageSize: z.number().min(1).max(100)
    }),
    execute: async (input) => {
      return await this.err.wrap(async () => {
        this.logger.log(`[getNewestProducts] called`);

        const response =
          await this.productService.getAllProductsWithVariants({
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

        const items = (response.data?.items || []).map(
          this.mapToMinimalProduct
        );
        return { success: true, ...encodeToolOutput(items) };
      }, 'errors.product.tool_newest');
    }
  });

  getBestSellingProducts: Tool = tool({
    description:
      'Get the best-selling products ranked by total sold quantity. Results are TOON-encoded.',
    inputSchema: z.object({
      pageNumber: z.number().min(1),
      pageSize: z.number().min(1).max(100)
    }),
    execute: async (input) => {
      this.logger.log(`[getBestSellingProducts] called`);
      return await this.err.wrap(async () => {
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

        const items = (response.data?.items || []).map(
          this.mapToMinimalProduct
        );
        return { success: true, ...encodeToolOutput(items) };
      }, 'errors.product.tool_best_selling');
    }
  });

  getLeastSellingProducts: Tool = tool({
    description:
      'Get the least-selling products (including those with zero sales). Results are TOON-encoded.',
    inputSchema: z.object({
      pageNumber: z.number().min(1),
      pageSize: z.number().min(1).max(100)
    }),
    execute: async (input) => {
      this.logger.log(`[getLeastSellingProducts] called`);
      return await this.err.wrap(async () => {
        const response = await this.productService.getLeastSellingProducts({
          PageNumber: input.pageNumber,
          PageSize: input.pageSize,
          SortOrder: 'asc',
          IsDescending: false
        });

        if (!response.success) {
          return {
            success: false,
            error: 'Failed to fetch least-selling products.'
          };
        }

        const items = (response.data?.items || []).map(
          this.mapToMinimalProduct
        );
        return { success: true, ...encodeToolOutput(items) };
      }, 'errors.product.tool_least_selling');
    }
  });

  getStaticProductPolicy: Tool = tool({
    description:
      'Get static information about usage, storage, shipping and returns policy. (Does NOT fetch product data).',
    inputSchema: z.object({
      content: z.enum(['usageAndStorage', 'shippingAndReturn'])
    }),
    execute: async ({ content }) => {
      this.logger.log(
        `[getStaticProductPolicy] called with content: ${content}`
      );
      return productDetailTabsContent[content];
    }
  });

  queryProducts: Tool = tool({
    description:
      'Query products using structured logic (DNF), sorting, and budget constraints. Results are TOON-encoded.',
    inputSchema: z.object({
      logic: z
        .array(z.union([z.string(), z.array(z.string())]))
        .describe('DNF logic for attributes.'),
      sorting: z
        .object({
          field: z.enum(['Price', 'Sales', 'Newest', 'Relevance', 'Name']),
          isDescending: z.boolean()
        })
        .nullable(),
      budget: z
        .object({
          min: z.number().nullable(),
          max: z.number().nullable()
        })
        .nullable(),
      pagination: z
        .object({
          pageNumber: z.number(),
          pageSize: z.number()
        })
        .nullable()
    }),
    execute: async (analysis) => {
      this.logger.log(
        `[queryProducts] Executing structured query: ${JSON.stringify(analysis, null, 2)}`
      );
      const result =
        await this.productService.getProductsByStructuredQuery(analysis);
      this.logger.log(
        `[queryProducts] Found ${result.data?.items?.length} products.`
      );
      const items = (result.data?.items || []).map(this.mapToMinimalProduct);
      return {
        ...result.data,
        ...encodeToolOutput(items),
        items: undefined // Remove unencoded items
      };
    }
  });

  getProductDetail: Tool = tool({
    description:
      'Get full detailed information for specific products by their IDs. ' +
      'Use this tool after finding candidate products to get their descriptions, scent notes, and variants.',
    inputSchema: z.object({
      productIds: z
        .array(z.string().uuid())
        .describe('Array of product IDs to fetch details for.')
    }),
    execute: async ({ productIds }) => {
      this.logger.log(
        `[getProductDetail] called for ${productIds.length} products`
      );
      return await this.err.wrap(async () => {
        const response =
          await this.productService.getProductsByIdsForOutput(productIds);
        if (!response.success) {
          return { success: false, error: 'Failed to fetch product details.' };
        }
        return { success: true, data: response.data };
      }, 'errors.product.tool_detail');
    }
  });
}
