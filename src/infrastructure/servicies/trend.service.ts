import { Inject, Injectable } from '@nestjs/common';
import { Output } from 'ai';
import { ZodObject } from 'zod';
import { AllUserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import {
  AITrendForecastStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import {
  trendForecastingPrompt,
  INSTRUCTION_TYPE_TREND
} from 'src/application/constant/prompts';
import { convertProductCardOutputToProducts, searchOutput, trendOutput } from 'src/chatbot/utils/output/search.output';
import { productOutput, ProductCardOutputItem, ProductCardVariantOutput } from 'src/chatbot/utils/output/product.output';
import { AIHelper } from '../helpers/ai.helper';
import { AI_TREND_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { InventoryService } from './inventory.service';
import { RestockService } from './restock.service';
import { ProductCardResponse, ProductCardVariantResponse } from 'src/application/dtos/response/product-card.response';

type VariantSalesSignal = {
  last30DaysSales: number;
  totalQuantitySold: number;
};

function buildTrendAnalysisContext(
  allUserLogRequest: AllUserLogRequest
): string {
  const context = {
    period: allUserLogRequest.period ?? 'monthly',
    startDate: allUserLogRequest.startDate?.toISOString() ?? null,
    endDate: allUserLogRequest.endDate?.toISOString() ?? null
  };

  return JSON.stringify(context, null, 2);
}

@Injectable()
export class TrendService {
  constructor(
    @Inject(AI_TREND_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly inventoryService: InventoryService,
    private readonly restockService: RestockService
  ) { }

  private async getVariantSalesSignalMap(
    variantIds: Set<string>
  ): Promise<Map<string, VariantSalesSignal>> {
    const salesSignalMap = new Map<string, VariantSalesSignal>();

    if (variantIds.size === 0) {
      return salesSignalMap;
    }

    const analyticsResult = await this.restockService.getProductSalesAnalyticsForRestock();
    if (!analyticsResult.success || !analyticsResult.payload) {
      console.warn('[TrendProduct] Cannot load sales analytics for variant ranking.');
      return salesSignalMap;
    }

    for (const variant of analyticsResult.payload) {
      if (!variantIds.has(variant.variantId)) {
        continue;
      }

      salesSignalMap.set(variant.variantId, {
        last30DaysSales: variant.salesMetrics?.last30DaysSales ?? -1,
        totalQuantitySold: variant.totalQuantitySold ?? -1
      });
    }

    return salesSignalMap;
  }

  private rankVariantsBySalesPriority(
    variants: ProductCardVariantOutput[],
    salesSignalMap: Map<string, VariantSalesSignal>
  ): ProductCardVariantResponse[] {
    return [...variants]
      .sort((left, right) => {
        const leftSignal = salesSignalMap.get(left.id);
        const rightSignal = salesSignalMap.get(right.id);

        const leftLast30 = leftSignal?.last30DaysSales ?? -1;
        const rightLast30 = rightSignal?.last30DaysSales ?? -1;
        if (rightLast30 !== leftLast30) {
          return rightLast30 - leftLast30;
        }

        const leftTotalSold = leftSignal?.totalQuantitySold ?? -1;
        const rightTotalSold = rightSignal?.totalQuantitySold ?? -1;
        if (rightTotalSold !== leftTotalSold) {
          return rightTotalSold - leftTotalSold;
        }

        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        if (left.volumeMl !== right.volumeMl) {
          return left.volumeMl - right.volumeMl;
        }

        return left.id.localeCompare(right.id);
      })
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        volumeMl: variant.volumeMl,
        basePrice: variant.basePrice
      }));
  }

  private toTrendProductCards(
    products: ProductCardOutputItem[],
    salesSignalMap: Map<string, VariantSalesSignal>
  ): ProductCardResponse[] {
    return products
      .map((product) => {
        const orderedVariants = this.rankVariantsBySalesPriority(product.variants, salesSignalMap);
        const displayVariant = orderedVariants[0];

        if (!displayVariant) {
          return null;
        }

        return {
          id: product.id,
          name: product.name,
          brandName: product.brandName,
          primaryImage: product.primaryImage,
          variants: orderedVariants,
          sizesCount: orderedVariants.length,
          displayPrice: displayVariant.basePrice
        };
      })
      .filter((product): product is ProductCardResponse => product !== null);
  }

  /** Dự đoán xu hướng từ tổng hợp log người dùng */
  async generateTrendSummary(
    allUserLogRequest: AllUserLogRequest,
    output: ZodObject = searchOutput.schema
  ): Promise<BaseResponse<string>> {
    const trendPrompt = trendForecastingPrompt(
      buildTrendAnalysisContext(allUserLogRequest)
    );
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_TREND);

    const trendResponse = await this.aiHelper.textGenerateFromPrompt(
      trendPrompt,
      adminPrompt,
      Output.object({ schema: output === searchOutput.schema ? trendOutput.schema : output })
    );

    if (!trendResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIHelper',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.generateTrendSummary'
      });
    }

    const trendData = typeof trendResponse.data === 'string'
      ? trendResponse.data
      : JSON.stringify(trendResponse.data);
    this.inventoryService.saveTrendLog(trendData).catch((err) => {
      console.error('Failed to save trend log:', err);
    });

    return Ok(trendResponse.data);
  }

  /** Lấy product từ xu hướng người dùng */
  async getTrendProducts(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductCardResponse[]>> {
    const trendResult = await this.generateTrendSummary(allUserLogRequest, productOutput.schema);
    if (!trendResult.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIHelper',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.getTrendProducts'
      });
    }

    const trendProducts = convertProductCardOutputToProducts(trendResult.data);
    const variantIds = new Set(
      trendProducts.flatMap((product) => product.variants.map((variant) => variant.id))
    );
    const salesSignalMap = await this.getVariantSalesSignalMap(variantIds);
    const products = this.toTrendProductCards(trendProducts, salesSignalMap);

    return Ok(products);
  }

  /** Dự đoán xu hướng có cấu trúc với metadata */
  async generateStructuredTrendForecast(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<AITrendForecastStructuredResponse>> {
    const startTime = Date.now();
    const trendPrompt = trendForecastingPrompt(
      buildTrendAnalysisContext(allUserLogRequest)
    );
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_TREND);

    const trendResponse = await this.aiHelper.textGenerateFromPrompt(trendPrompt, adminPrompt);

    if (!trendResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIHelper',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.generateStructuredTrendForecast'
      });
    }

    const processingTimeMs = Date.now() - startTime;
    const period = allUserLogRequest.period ?? 'custom';

    return Ok(new AITrendForecastStructuredResponse({
      forecast: trendResponse.data ?? '',
      period: period.toString(),
      analyzedLogCount: 0,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    }));
  }
}
