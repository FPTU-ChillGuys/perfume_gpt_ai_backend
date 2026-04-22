import { Controller, Get, Inject, Param, Query, Req, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { AllUserLogRequest, AllUserLogWithForceRefreshRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { AITrendForecastStructuredResponse } from 'src/application/dtos/response/ai-structured.response';
import { createBackgroundJob, checkBackgroundJobResult } from 'src/api/controllers/helper/background-job.helper';
import { CacheInterceptor, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CACHE_TTL_1WEEK } from 'src/infrastructure/domain/common/cacheable/cacheable.constants';
import { ProductCardResponse } from 'src/application/dtos/response/product-card.response';
import { TrendService } from 'src/infrastructure/domain/trend/trend.service';

const cachingTrendTTL = CACHE_TTL_1WEEK;

@Role(['admin', 'user'])
@ApiTags('Trends')
@Controller('trends')
export class TrendController {
  constructor(
    private readonly trendService: TrendService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) { }


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
  @CacheTTL(cachingTrendTTL)
  @UseInterceptors(CacheInterceptor)
  async getProductFromTrendCaching(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductCardResponse[]>> {
    const trendResult = await this.getProductFromTrend(allUserLogRequest)
    return trendResult
  }

  /**
    * Khởi tạo job để lấy product từ xu hướng (caching 1 tuần)
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

}
