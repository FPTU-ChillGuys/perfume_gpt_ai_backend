import { Body, Controller, Get, Inject, Param, Query, Req, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { AllUserLogRequest, AllUserLogWithForceRefreshRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { AITrendForecastStructuredResponse } from 'src/application/dtos/response/ai-structured.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { createBackgroundJob, checkBackgroundJobResult } from 'src/api/controllers/helper/background-job.helper';
import { CacheInterceptor, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { CACHE_TTL_1WEEK } from 'src/infrastructure/cacheable/cacheable.constants';
import { TrendService } from 'src/infrastructure/servicies/trend.service';
import { ProductCardResponse } from 'src/application/dtos/response/product-card.response';

const cachingTrendTTL = CACHE_TTL_1WEEK;

@Role(['admin', 'user'])
@ApiTags('Trends')
@Controller('trends')
export class TrendController {
  constructor(
    private readonly trendService: TrendService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) { }


  /** Dự đoán xu hướng từ tổng hợp log người dùng */
  @Get('summary')
  @Public()
  @ApiOperation({ summary: 'Dự đoán xu hướng dựa trên tổng hợp log người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: AllUserLogRequest })
  async summarizeLogs(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<string>> {
    return this.trendService.generateTrendSummary(allUserLogRequest);
  }

  async getProductFromTrend(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductCardResponse[]>> {
    return this.trendService.getTrendProducts(allUserLogRequest);
  }


  /** Lấy product từ xu hướng người dùng (caching) */
  // kích hoạt cache response
  @Public()
  @Get("product/caching")
  @ApiOperation({ summary: 'Lấy product từ xu hướng người dùng (caching)' })
  @ApiBaseResponse(ProductCardResponse)
  @ApiBody({ type: AllUserLogRequest })
  @CacheTTL(60 * 60 * 24 * 1000)
  @UseInterceptors(CacheInterceptor)
  async getProductFromTrendCaching(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductCardResponse[]>> {
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
  // @CacheTTL(cachingTrendTTL) // cache kết quả API (tức là jobId) trong 1 ngày
  // @UseInterceptors(CacheInterceptor)
  async createProductTrendJob(
    @Req() request: Request,
    @Query() allUserLogWithForceRefreshRequest: AllUserLogWithForceRefreshRequest,
  ): Promise<BaseResponse<{ jobId: string }>> {
    return createBackgroundJob(
      this.cacheManager,
      () => this.getProductFromTrend(allUserLogWithForceRefreshRequest),
      {
        type: 'trend_job',
        cacheKeyFactory: (jobId) => `trend_job_${jobId}`,
        ttlMilliseconds: cachingTrendTTL,
        forceRefresh: allUserLogWithForceRefreshRequest.forceRefresh === true || String(allUserLogWithForceRefreshRequest.forceRefresh) === 'true',
        cacheByRequest: true
      },
      request
    );
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
    return checkBackgroundJobResult(
      this.cacheManager,
      `trend_job_${jobId}`,
      { jobId, endpoint: 'trends/product/job/:jobId' }
    );
  }

  /** Lấy product từ xu hướng người dùng */
  @Public()
  @Get("product")
  @ApiOperation({ summary: 'Lấy product từ xu hướng người dùng' })
  @ApiBaseResponse(ProductCardResponse)
  @ApiBody({ type: AllUserLogRequest })
  @CacheTTL(1) // 1 ms
  @UseInterceptors(CacheInterceptor)  // kích hoạt cache response
  async getProductNoCaching(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductCardResponse[]>> {
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
    return this.trendService.generateStructuredTrendForecast(allUserLogRequest);
  }
}
