import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { ReviewListItemResponse, ReviewResponse } from 'src/application/dtos/response/review.response';
import { reviewSummaryPrompt } from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ReviewService } from 'src/infrastructure/servicies/review.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { AIReviewSummaryStructuredResponse } from 'src/application/dtos/response/ai-structured.response';
import { AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';
import { isArrayEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';

@Public()
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService,
        @Inject(AI_SERVICE) private aiService: AIService
    ) {}

    /** Lấy danh sách đánh giá */
    @Get()
    @ApiOperation({ summary: 'Lấy danh sách đánh giá (phân trang)' })
    @ApiBaseResponse(PagedResult<ReviewListItemResponse>)
    async getReviews(@Query() request: GetPagedReviewRequest): Promise<BaseResponseAPI<PagedResult<ReviewListItemResponse>>> {
        return await this.reviewService.getAllReviews(request);
    }

    /** Tóm tắt đánh giá bằng AI theo variant ID */
    @Get('summary/:variantId')
    @ApiBaseResponse(String)
    @ApiOperation({ summary: 'Tóm tắt đánh giá bằng AI theo variant ID' })
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async getReviewSummaryByVariantId(@Param('variantId') variantId: string): Promise<BaseResponse<string>> {
        const reviewsResponse = await this.reviewService.getReviewsByVariantId(variantId);

        if (!reviewsResponse.success) {
            return { success: false, error: 'Failed to fetch reviews' };
        }

        const reviews = reviewsResponse.payload ? reviewsResponse.payload : [];

        if (isArrayEmpty(reviews)) {
            return { success: true, data: INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY };
        }

        const reviewsText = reviews.map((review: ReviewResponse) => review.comment).join('\n');

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            reviewSummaryPrompt(reviewsText)
        );

        if (!summaryResponse.success) {
            return { success: false, error: 'Failed to get AI summary response' };
        }

        return { success: true, data: summaryResponse.data };
    }

    /** Tóm tắt đánh giá bằng AI cho tất cả variant */
    @Get('summary/all')
    @ApiBaseResponse(String)
    @ApiOperation({ summary: 'Tóm tắt đánh giá bằng AI cho tất cả variant' })
    async getReviewSummaryFromAllVariant(request: GetPagedReviewRequest): Promise<BaseResponse<string>> {
        const reviewsResponse = await this.reviewService.getAllReviews(request);

        if (!reviewsResponse.success) {
            return { success: false, error: 'Failed to fetch reviews' };
        }

        const reviews = reviewsResponse.payload ? reviewsResponse.payload.items : [];

        if (isArrayEmpty(reviews)) {
            return { success: true, data: INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY };
        }

        const reviewsText = reviews.map((review: ReviewListItemResponse) => review.commentPreview).join('\n');

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            reviewSummaryPrompt(reviewsText)
        );

        if (!summaryResponse.success) {
            return { success: false, error: 'Failed to get AI summary response' };
        }

        return { success: true, data: summaryResponse.data };
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
        const startTime = Date.now();

        const reviewsResponse = await this.reviewService.getReviewsByVariantId(variantId);

        if (!reviewsResponse.success) {
            return { success: false, error: 'Failed to fetch reviews' };
        }

        const reviews = reviewsResponse.payload ? reviewsResponse.payload : [];

        if (isArrayEmpty(reviews)) {
            return { success: true, data: new AIReviewSummaryStructuredResponse({
                summary: INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY,
                variantId,
                reviewCount: 0,
                generatedAt: new Date(),
                metadata: new AIResponseMetadata({ processingTimeMs: Date.now() - startTime })
            })};
        }

        const reviewsText = reviews.map((review: ReviewResponse) => review.comment).join('\n');

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            reviewSummaryPrompt(reviewsText)
        );

        if (!summaryResponse.success) {
            return { success: false, error: 'Failed to get AI summary response' };
        }

        const processingTimeMs = Date.now() - startTime;

        const structuredResponse = new AIReviewSummaryStructuredResponse({
            summary: summaryResponse.data ?? '',
            variantId,
            reviewCount: reviews.length,
            generatedAt: new Date(),
            metadata: new AIResponseMetadata({ processingTimeMs })
        });

        return { success: true, data: structuredResponse };
    }
    
    
}
