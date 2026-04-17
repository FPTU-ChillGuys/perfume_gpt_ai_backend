import { Body, Controller, Get, Inject, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { createBackgroundJob, checkBackgroundJobResult } from 'src/api/controllers/helper/background-job.helper';
import { Public, Role } from 'src/application/common/Metadata';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { ReviewListItemResponse } from 'src/application/dtos/response/review.response';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { ReviewAIService } from 'src/infrastructure/domain/review/review-ai.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { AIReviewSummaryStructuredResponse } from 'src/application/dtos/response/ai-structured.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';
import { CACHE_TTL_1MONTH } from 'src/infrastructure/domain/common/cacheable/cacheable.constants';

@ApiBearerAuth('jwt')
@Role(['admin'])
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService,
        private readonly reviewAIService: ReviewAIService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }



    /** Tóm tắt đánh giá bằng AI cho tất cả variant */
    @Get('summary/all')
    @ApiBaseResponse(String)
    @ApiOperation({ summary: 'Tóm tắt đánh giá bằng AI cho tất cả variant' })
    async getReviewSummaryFromAllVariant(): Promise<BaseResponse<string>> {
        return this.reviewAIService.generateReviewSummaryAll();
    }

    /** Lấy danh sách đánh giá */
    @Get()
    @ApiOperation({ summary: 'Lấy danh sách đánh giá (phân trang)' })
    @ApiBaseResponse(PagedResult<ReviewListItemResponse>)
    async getReviews(@Query() request: GetPagedReviewRequest): Promise<BaseResponseAPI<PagedResult<ReviewListItemResponse>>> {
        return await this.reviewService.getAllReviews(request);
    }

    /** 
     * Khởi tạo job để lấy tóm tắt đánh giá bằng AI theo variant ID (caching 1 tuần) 
     */
    @Public()
    @Get('summary/job/:variantId')
    @ApiOperation({ summary: 'Khởi tạo job để tóm tắt đánh giá theo variant ID' })
    @ApiBaseResponse(String)
    @CacheTTL(CACHE_TTL_1MONTH) // cache kết quả API (tức là jobId) trong 1 tuần
    @UseInterceptors(CacheInterceptor)
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async createReviewSummaryJob(
        @Param('variantId') variantId: string
    ): Promise<BaseResponse<{ jobId: string }>> {
        return createBackgroundJob(
            this.cacheManager,
            () => this.getReviewSummaryByVariantId(variantId),
            {
                type: `review_summary_job_${variantId}`,
                cacheKeyFactory: (jobId) => `review_summary_job_${jobId}_${variantId}`,
                ttlMilliseconds: CACHE_TTL_1MONTH
            }
        );
    }

    /**
     * Kiểm tra kết quả job lấy tóm tắt đánh giá
     */
    @Public()
    @Get('summary/job/result/:jobId')
    @ApiOperation({ summary: 'Kiểm tra trạng thái hoàn thành của job tóm tắt đánh giá' })
    @ApiBaseResponse(Object) // Trả về dynamic object
    @ApiQuery({ name: 'variantId', description: 'ID của variant sản phẩm đã dùng tạo job', required: true })
    async getReviewSummaryJobResult(
        @Param('jobId') jobId: string,
        @Query('variantId') variantId: string
    ): Promise<BaseResponse<any>> {
        return checkBackgroundJobResult(
            this.cacheManager,
            `review_summary_job_${jobId}_${variantId}`,
            { jobId, variantId, endpoint: 'reviews/summary/job/result/:jobId' }
        );
    }

    /** Tóm tắt đánh giá bằng AI theo variant ID */
    @Get('summary/:variantId')
    @ApiBaseResponse(String)
    @ApiOperation({ summary: 'Tóm tắt đánh giá bằng AI theo variant ID' })
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async getReviewSummaryByVariantId(@Param('variantId') variantId: string): Promise<BaseResponse<string>> {
        return this.reviewAIService.generateReviewSummaryByVariantId(variantId);
    }


    /**
     * Tóm tắt đánh giá bằng AI theo variant ID - Phiên bản có cấu trúc.
     * Trả về response có metadata (thời gian xử lý, số review đã phân tích).
     */
    @Get('summary/structured/:variantId')
    @ApiBaseResponse(AIReviewSummaryStructuredResponse)
    @ApiOperation({ summary: 'Tóm tắt đánh giá có cấu trúc theo variant ID' })
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async getStructuredReviewSummaryByVariantId(
        @Param('variantId') variantId: string
    ): Promise<BaseResponse<AIReviewSummaryStructuredResponse>> {
        return this.reviewAIService.generateStructuredReviewSummary(variantId);
    }

    /** Thêm review log */
    @Post('logs')
    @ApiBaseResponse(ReviewLog)
    @ApiOperation({ summary: 'Thêm review log' })
    async addReviewLog(@Body() request: {
        type: ReviewTypeEnum,
        variantId: string,
        reviewLog: string
    }): Promise<BaseResponseAPI<ReviewLog>> {
        return await this.reviewService.addReviewLog(request.type, request.variantId, request.reviewLog);
    }

    /** Lấy review logs theo variant ID */
    @Get('logs/variant/:variantId')
    @ApiBaseResponse(ReviewLog)
    @ApiOperation({ summary: 'Lấy review logs theo variant ID' })
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async getReviewLogsByVariantId(@Param('variantId') variantId: string): Promise<BaseResponseAPI<ReviewLog[]>> {
        return await this.reviewService.getReviewLogsByVariantId(variantId);
    }

    /** Lấy review log mới nhất theo variant ID */
    @Public()
    @Get('logs/latest/variant/:variantId')
    @ApiBaseResponse(ReviewLog)
    @ApiOperation({ summary: 'Lấy review log mới nhất theo variant ID' })
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async getLatestReviewLogByVariantId(@Param('variantId') variantId: string): Promise<BaseResponseAPI<ReviewLog>> {
        return await this.reviewService.getLatestReviewLogByVariantId(variantId);
    }

    /** Lấy review log theo ID */
    @Get('logs/:id')
    @ApiBaseResponse(ReviewLog)
    @ApiOperation({ summary: 'Lấy review log theo ID' })
    @ApiParam({ name: 'id', description: 'ID của review log' })
    async getReviewLogById(@Param('id') id: string): Promise<BaseResponseAPI<ReviewLog>> {
        return await this.reviewService.getReviewLogById(id);
    }

    /** Lấy tất cả review logs */
    @Get('logs')
    @ApiBaseResponse(ReviewLog)
    @ApiOperation({ summary: 'Lấy tất cả review logs' })
    async getAllReviewLogs(): Promise<BaseResponseAPI<ReviewLog[]>> {
        return await this.reviewService.getAllReviewLogs();
    }
}
