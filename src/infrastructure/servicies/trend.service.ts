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
import { ProductResponse } from 'src/application/dtos/response/product.response';
import {
  trendForecastingPrompt,
  INSTRUCTION_TYPE_TREND
} from 'src/application/constant/prompts';
import { convertSearchOutputToProductResponse, searchOutput } from 'src/chatbot/utils/output/search.output';
import { productOutput } from 'src/chatbot/utils/output/product.output';
import { AIHelper } from '../helpers/ai.helper';
import { AI_TREND_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { InventoryService } from './inventory.service';

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
    private readonly inventoryService: InventoryService
  ) {}

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
      Output.object({ schema: output })
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
  ): Promise<BaseResponse<ProductResponse[]>> {
    const trendResult = await this.generateTrendSummary(allUserLogRequest, productOutput.schema);
    if (!trendResult.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIHelper',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.getTrendProducts'
      });
    }
    const products = convertSearchOutputToProductResponse(trendResult.data ?? '');
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
