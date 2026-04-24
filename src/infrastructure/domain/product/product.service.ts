import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ProductNatsRepository } from '../repositories/nats/product-nats.repository';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { BestSellingProductResponse } from 'src/application/dtos/response/product-insight.response';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { DictionaryBuilderService } from 'src/infrastructure/domain/common/dictionary-builder.service';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly productNatsRepo: ProductNatsRepository,
    private readonly httpService: HttpService,
    private readonly nlpEngine: NlpEngineService,
    private readonly dictionaryBuilder: DictionaryBuilderService,
    private readonly configService: ConfigService,
  ) { }

  /** 
   * Internal helper to convert Redis responses.
   * Returns a hybrid object with both 'data' and 'payload' to maintain compatibility 
   * with old internal callers (expecting 'data') and new external callers (expecting 'payload').
   */
  private wrapHybridResponse(content: any): any {
    return {
      success: true,
      error: null,
      payload: content,
      data: content
    };
  }

  async getAllProducts(
    request: PagedAndSortedRequest
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getBestSelling({
        PageNumber: request.PageNumber,
        PageSize: request.PageSize
      });
      return this.wrapHybridResponse(result);
    }, 'Failed to fetch products');
  }

  async getAllProductsWithVariants(
    request: PagedAndSortedRequest
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getNewest(request);
      return this.wrapHybridResponse(result);
    }, 'Failed to fetch products with variants');
  }

  async getProductWithVariants(id: string): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getProductsByIds([id]);
      const data = result.items?.[0] ?? null;
      return this.wrapHybridResponse(data);
    }, 'Failed to fetch product with variants');
  }

  async resolveProductViewInfo(productId: string, variantId?: string): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getProductsByIds([productId]);
      const product = result.items?.[0] ?? null;
      if (!product) return { success: false, error: 'Product not found' };
      
      const variant = variantId ? product.variants?.find((v: any) => v.id === variantId) : product.variants?.[0];
      
      return {
        success: true,
        data: {
          productName: product.name,
          variantName: variant ? `${product.name} - ${variant.volumeMl}ml ${variant.type}` : product.name,
          brand: product.brandName,
          category: product.categoryName,
          gender: product.attributes?.find(a => a.attribute === 'Gender')?.value || 'Unisex',
          scentNotes: product.scentNotes,
          olfactoryFamilies: product.olfactoryFamilies,
          basePrice: variant?.basePrice || 0
        }
      };
    }, 'Failed to resolve product view info');
  }

  async getProductsByStructuredQuery(
    analysis: any
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getByStructuredQuery(analysis);
      return this.wrapHybridResponse(result);
    }, 'Failed to fetch products by structured query');
  }

  async getBestSellingProducts(
    request: PagedAndSortedRequest
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getBestSelling(request);
      return this.wrapHybridResponse(result);
    }, 'Failed to fetch best selling products');
  }

  async getLeastSellingProducts(
    request: PagedAndSortedRequest
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getBestSelling({ ...request, SortOrder: 'asc', IsDescending: false });
      return this.wrapHybridResponse(result);
    }, 'Failed to fetch least selling products');
  }

  async getNewestProductsWithVariants(
    request: PagedAndSortedRequest
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getNewest(request);
      return this.wrapHybridResponse(result);
    }, 'Failed to fetch newest products');
  }

  async getProductsByIdsForOutput(
    ids: string[]
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const result = await this.productNatsRepo.getProductsByIds(ids);
      const data = result.items ?? [];
      return this.wrapHybridResponse(data);
    }, 'Failed to fetch products by ids');
  }

  async getProductsUsingAiSearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<any> {
    return this.getProductsUsingSemanticSearch(searchText, request);
  }

  async getProductsUsingSemanticSearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<any> {
    return await funcHandlerAsync(async () => {
      const parsedResult = this.nlpEngine.parseAndNormalize(searchText);
      const res = await this.getProductsByStructuredQuery({
        ...parsedResult,
        pagination: { pageNumber: request.PageNumber, pageSize: request.PageSize }
      });
      return this.wrapHybridResponse(res);
    }, 'Failed to fetch products by semantic search');
  }
}
