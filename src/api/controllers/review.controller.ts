import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { ReviewListItemResponse, ReviewResponse } from 'src/application/dtos/response/review.response';
import { reviewSummaryPrompt, INSTRUCTION_TYPE_REVIEW } from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ReviewService } from 'src/infrastructure/servicies/review.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { AIReviewSummaryStructuredResponse } from 'src/application/dtos/response/ai-structured.response';
import { AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';
import { isArrayEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';

@ApiBearerAuth('jwt')
@Role(['admin'])
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService,
        @Inject(AI_SERVICE) private aiService: AIService,
        private readonly adminInstructionService: AdminInstructionService
    ) { }



    /** Tóm tắt đánh giá bằng AI cho tất cả variant */
    @Get('summary/all')
    @ApiBaseResponse(String)
    @ApiOperation({ summary: 'Tóm tắt đánh giá bằng AI cho tất cả variant' })
    async getReviewSummaryFromAllVariant(): Promise<BaseResponse<string>> {
        // const reviewsResponse = await this.reviewService.getAllReviews(new GetPagedReviewRequest());

        // if (!reviewsResponse.success) {
        //     throw new InternalServerErrorWithDetailsException('Failed to fetch reviews', {
        //         service: 'ReviewService',
        //         endpoint: 'reviews/summary/all'
        //     });
        // }

        // const reviews = reviewsResponse.payload ? reviewsResponse.payload.items : [];

        // if (isArrayEmpty(reviews)) {
        //     return Ok(INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY);
        // }

        // const reviewsText = reviews.map((review: ReviewListItemResponse) => review.commentPreview).join('\n');

        // Lấy admin instruction cho domain review (nếu có)
        const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            "",
            adminPrompt
        );

        if (!summaryResponse.success) {
            throw new InternalServerErrorWithDetailsException('Failed to get AI summary response', {
                service: 'AIService',
                endpoint: 'reviews/summary/all'
            });
        }

        return Ok(summaryResponse.data);
    }

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
        // const reviewsResponse = await this.reviewService.getReviewsByVariantId(variantId);

        // if (!reviewsResponse.success) {
        //     throw new InternalServerErrorWithDetailsException('Failed to fetch reviews', {
        //         variantId,
        //         service: 'ReviewService',
        //         endpoint: 'reviews/summary/:variantId'
        //     });
        // }

        // const reviews = reviewsResponse.payload ? reviewsResponse.payload : [];

        // if (isArrayEmpty(reviews)) {
        //     return Ok(INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY);
        // }

        // const reviewsText = reviews.map((review: ReviewResponse) => review.comment).join('\n');

        // Lấy admin instruction cho domain review (nếu có)
        const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            "ID variant: " + variantId,
            adminPrompt
        );

        if (!summaryResponse.success) {
            throw new InternalServerErrorWithDetailsException('Failed to get AI summary response', {
                variantId,
                service: 'AIService',
                endpoint: 'reviews/summary/:variantId'
            });
        }

        return Ok(summaryResponse.data);
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
            throw new InternalServerErrorWithDetailsException('Failed to fetch reviews', {
                variantId,
                service: 'ReviewService',
                endpoint: 'reviews/summary/structured/:variantId'
            });
        }

        const reviews = reviewsResponse.payload ? reviewsResponse.payload : [];

        if (isArrayEmpty(reviews)) {
            return Ok(new AIReviewSummaryStructuredResponse({
                summary: INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY,
                variantId,
                reviewCount: 0,
                generatedAt: new Date(),
                metadata: new AIResponseMetadata({ processingTimeMs: Date.now() - startTime })
            }));
        }

        const reviewsText = reviews.map((review: ReviewResponse) => review.comment).join('\n');

        // Lấy admin instruction cho domain review (nếu có)
        const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            reviewSummaryPrompt(reviewsText),
            adminPrompt
        );

        if (!summaryResponse.success) {
            throw new InternalServerErrorWithDetailsException('Failed to get AI summary response', {
                variantId,
                service: 'AIService',
                endpoint: 'reviews/summary/structured/:variantId'
            });
        }

        const processingTimeMs = Date.now() - startTime;

        const structuredResponse = new AIReviewSummaryStructuredResponse({
            summary: summaryResponse.data ?? '',
            variantId,
            reviewCount: reviews.length,
            generatedAt: new Date(),
            metadata: new AIResponseMetadata({ processingTimeMs })
        });

        return Ok(structuredResponse);
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
