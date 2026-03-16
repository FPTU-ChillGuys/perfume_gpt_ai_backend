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
  ADVANCED_MATCHING_SYSTEM_PROMPT,
  trendForecastingPrompt,
  INSTRUCTION_TYPE_TREND
} from 'src/application/constant/prompts';
import { isDataEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';
import { convertSearchOutputToProductResponse, searchOutput } from 'src/chatbot/utils/output/search.output';
import { productOutput } from 'src/chatbot/utils/output/product.output';
import { AIHelper } from '../helpers/ai.helper';
import { AI_TREND_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { UserLogService } from './user-log.service';
import { InventoryService } from './inventory.service';

@Injectable()
export class TrendService {
  constructor(
    @Inject(AI_TREND_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    private readonly inventoryService: InventoryService
  ) {}

  /** Dự đoán xu hướng từ tổng hợp log người dùng */
  async generateTrendSummary(
    allUserLogRequest: AllUserLogRequest,
    output: ZodObject = searchOutput.schema
  ): Promise<BaseResponse<string>> {
    const summaries = await this.userLogService.getAllUserLogSummaryReport();

    if (!summaries.success) {
      throw new InternalServerErrorWithDetailsException('Failed to summarize user logs', {
        service: 'UserLogService',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.generateTrendSummary'
      });
    }

    const trendPrompt = trendForecastingPrompt(summaries.data ?? '');
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

    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryAllUsersLogs(allUserLogRequest);

    if (!reportAndPromptSummary.success) {
      throw new InternalServerErrorWithDetailsException('Failed to summarize user logs', {
        service: 'UserLogService',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.generateStructuredTrendForecast'
      });
    }

    if (isDataEmpty(reportAndPromptSummary.data?.prompt)) {
      const processingTimeMs = Date.now() - startTime;
      const period = allUserLogRequest.period ?? 'custom';
      return {
        success: true,
        data: new AITrendForecastStructuredResponse({
          forecast: INSUFFICIENT_DATA_MESSAGES.TREND_FORECAST,
          period: period.toString(),
          analyzedLogCount: 0,
          generatedAt: new Date(),
          metadata: new AIResponseMetadata({ processingTimeMs })
        })
      };
    }

    const reportResponse = await this.aiHelper.textGenerateFromPrompt(
      `${reportAndPromptSummary.data!.prompt}`
    );

    if (!reportResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI response', {
        service: 'AIHelper',
        period: allUserLogRequest.period,
        endpoint: 'TrendService.generateStructuredTrendForecast'
      });
    }

    const trendPrompt = trendForecastingPrompt(reportResponse.data ?? '');
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_TREND);
    const trendSystemPrompt = `${ADVANCED_MATCHING_SYSTEM_PROMPT}\n${adminPrompt}`;

    const trendResponse = await this.aiHelper.textGenerateFromPrompt(trendPrompt, trendSystemPrompt);

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
