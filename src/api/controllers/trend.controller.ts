import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { AllUserLogRequest, UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ADVANCED_MATCHING_SYSTEM_PROMPT, trendForecastingPrompt, INSTRUCTION_TYPE_TREND } from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { AITrendForecastStructuredResponse, AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';
import { isDataEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Output } from 'ai';
import { convertSearchOutputToProductResponse, searchOutput } from 'src/chatbot/utils/output/search.output';
import { processBackgroundJob } from 'src/api/controllers/helper/background-job.helper';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ZodObject } from 'zod';
import * as crypto from 'crypto';
import { productOutput } from 'src/chatbot/utils/output/product.output';
import { CACHE_TTL_1WEEK } from 'src/infrastructure/cacheable/cacheable.constants';

const cachingTrendTTL = CACHE_TTL_1WEEK; // TTL cache cho trend product (1 tuần)

@Role(['admin', 'user'])
@ApiTags('Trends')
@Controller('trends')
export class TrendController {
  constructor(
    private userLogService: UserLogService,
    @Inject(AI_SERVICE) private aiService: AIService,
    private readonly adminInstructionService: AdminInstructionService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }


  /** Dự đoán xu hướng từ tổng hợp log người dùng */
  @Get('summary')
  @Public()
  @ApiOperation({ summary: 'Dự đoán xu hướng dựa trên tổng hợp log người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: AllUserLogRequest })
  async summarizeLogs(
    @Query() allUserLogRequest: AllUserLogRequest,
    output: ZodObject = searchOutput.schema
  ): Promise<BaseResponse<string>> {
    const summaries =
      await this.userLogService.getAllUserLogSummaryReport(allUserLogRequest);

    if (!summaries.success) {
      throw new InternalServerErrorWithDetailsException('Failed to summarize user logs', {
        service: 'UserLogService',
        period: allUserLogRequest.period,
        endpoint: 'trends/summary'
      });
    }

    //Trend forecasting prompt base on summary response
    const trendPrompt = trendForecastingPrompt(summaries.data ?? '');

    // Lấy admin instruction cho domain trend (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_TREND);
    const trendSystemPrompt = `${adminPrompt}`;

    const trendResponse = await this.aiService.textGenerateFromPrompt(
      trendPrompt,
      trendSystemPrompt,
      Output.object({ schema: output })
    );

    if (!trendResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIService',
        period: allUserLogRequest.period,
        endpoint: 'trends/summary'
      });
    }

    return Ok(trendResponse.data);
  }

  async getProductFromTrend(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductResponse[]>> {
    const trendResult = await this.summarizeLogs(allUserLogRequest, productOutput.schema);
    if (!trendResult.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIService',
        period: allUserLogRequest.period,
        endpoint: 'trends/product'
      });
    }

    console.log(trendResult.data);

    /** Lay product tu trend data */
    const trendResponse = trendResult.data;
    const products = convertSearchOutputToProductResponse(trendResponse ?? '');
    return Ok(products)
  }


  /** Lấy product từ xu hướng người dùng (caching) */
  // kích hoạt cache response
  @Public()
  @Get("product/caching")
  @ApiOperation({ summary: 'Lấy product từ xu hướng người dùng (caching)' })
  @ApiBaseResponse(ProductResponse)
  @ApiBody({ type: AllUserLogRequest })
  @CacheTTL(60 * 60 * 24 * 1000)
  @UseInterceptors(CacheInterceptor)
  async getProductFromTrendCaching(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductResponse[]>> {
    const trendResult = await this.getProductFromTrend(allUserLogRequest)
    return trendResult
  }

  /**
   * Khởi tạo job để lấy product từ xu hướng (caching 1 ngày)
   */
  @Public()
  @Get('product/job')
  @ApiOperation({ summary: 'Khởi tạo job để lấy product từ xu hướng' })
  @ApiBaseResponse(String)
  @CacheTTL(cachingTrendTTL) // cache kết quả API (tức là jobId) trong 1 ngày
  @UseInterceptors(CacheInterceptor)
  async createProductTrendJob(
    @Req() request: Request,
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<{ jobId: string }>> {
    const jobId = crypto.randomUUID();
    const cacheKey = `trend_job_${jobId}`;

    // Lưu trạng thái job ban đầu là pending
    await this.cacheManager.set(cacheKey, { status: 'pending' }, cachingTrendTTL);

    // Chạy ngầm việc request data AI
    processBackgroundJob(
      this.cacheManager,
      () => this.getProductFromTrend(allUserLogRequest),
      { cacheKey, ttlMilliseconds: cachingTrendTTL },
      request
    );

    return Ok({ jobId });
  }

  /**
   * Kiểm tra kết quả job lấy product từ xu hướng
   */
  @Public()
  @Get('product/job/:jobId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoàn thành của job' })
  @ApiBaseResponse(Object) // Trả về dynamic object
  async getProductTrendJobResult(
    @Param('jobId') jobId: string
  ): Promise<BaseResponse<any>> {
    const jobData = await this.cacheManager.get(`trend_job_${jobId}`);

    if (!jobData) {
      throw new InternalServerErrorWithDetailsException('Job not found or expired', {
        jobId,
        endpoint: 'trends/product/job/:jobId'
      });
    }

    return Ok(jobData);
  }

  /** Lấy product từ xu hướng người dùng */
  @Public()
  @Get("product")
  @ApiOperation({ summary: 'Lấy product từ xu hướng người dùng' })
  @ApiBaseResponse(ProductResponse)
  @ApiBody({ type: AllUserLogRequest })
  @CacheTTL(1) // 1 ms
  @UseInterceptors(CacheInterceptor)  // kích hoạt cache response
  async getProductNoCaching(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductResponse[]>> {
    const trendResult = await this.getProductFromTrend(allUserLogRequest)
    return trendResult
  }

  /**
   * Dự đoán xu hướng có cấu trúc - Trả về metadata bổ sung (thời gian xử lý, khoảng thời gian phân tích).
   */
  @Get('summary/structured')
  @ApiOperation({ summary: 'Dự đoán xu hướng có cấu trúc với metadata' })
  @ApiBaseResponse(AITrendForecastStructuredResponse)
  @ApiBody({ type: AllUserLogRequest })
  async summarizeLogsStructured(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<AITrendForecastStructuredResponse>> {
    const startTime = Date.now();

    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryAllUsersLogs(allUserLogRequest);

    if (!reportAndPromptSummary.success) {
      throw new InternalServerErrorWithDetailsException('Failed to summarize user logs', {
        service: 'UserLogService',
        period: allUserLogRequest.period,
        endpoint: 'trends/summary/structured'
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

    const reportResponse = await this.aiService.textGenerateFromPrompt(
      `${reportAndPromptSummary.data!.prompt}`
    );

    if (!reportResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI response', {
        service: 'AIService',
        period: allUserLogRequest.period,
        endpoint: 'trends/summary/structured'
      });
    }

    const trendPrompt = trendForecastingPrompt(reportResponse.data ?? '');

    // Lấy admin instruction cho domain trend (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_TREND);
    const trendSystemPrompt = `${ADVANCED_MATCHING_SYSTEM_PROMPT}\n${adminPrompt}`;

    const trendResponse = await this.aiService.textGenerateFromPrompt(
      trendPrompt,
      trendSystemPrompt
    );

    if (!trendResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI trend response', {
        service: 'AIService',
        period: allUserLogRequest.period,
        endpoint: 'trends/summary/structured'
      });
    }

    const processingTimeMs = Date.now() - startTime;

    const period = allUserLogRequest.period ?? 'custom';
    const structuredResponse = new AITrendForecastStructuredResponse({
      forecast: trendResponse.data ?? '',
      period: period.toString(),
      analyzedLogCount: 0,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    });

    return Ok(structuredResponse);
  }
}
