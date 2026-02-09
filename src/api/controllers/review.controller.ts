import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { ReviewListItemResponse, ReviewResponse } from 'src/application/dtos/response/review.response';
import { reviewSummaryPrompt } from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ReviewService } from 'src/infrastructure/servicies/review.service';

@Public()
@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService,
        @Inject(AI_SERVICE) private aiService: AIService
    ) {}

    //Get reviews
    @Get()
    async getReviews(@Query() request: GetPagedReviewRequest): Promise<any> {
        return await this.reviewService.getAllReviews(request);
    }

    // Review summary
    // Review theo tung variant
    @Get('summary/:variantId')
    async getReviewSummaryByVariantId(@Query('variantId') variantId: string): Promise<any> {
        const reviewsResponse = await this.reviewService.getReviewsByVariantId(variantId);

        if (!reviewsResponse.success) {
            return { success: false, error: 'Failed to fetch reviews' };
        }

        const reviews = reviewsResponse.payload ? reviewsResponse.payload : [];
        const reviewsText = reviews.map((review: ReviewResponse) => review.comment).join('\n');

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            reviewSummaryPrompt(reviewsText)
        );

        if (!summaryResponse.success) {
            return { success: false, error: 'Failed to get AI summary response' };
        }

        return { success: true, data: summaryResponse.data };
    }

    // Review summary
    // Review theo tung variant
    @Get('summary/all')
    async getReviewSummaryFromAllVariant(request: GetPagedReviewRequest): Promise<any> {
        const reviewsResponse = await this.reviewService.getAllReviews(request);

        if (!reviewsResponse.success) {
            return { success: false, error: 'Failed to fetch reviews' };
        }

        const reviews = reviewsResponse.payload ? reviewsResponse.payload.items : [];
        const reviewsText = reviews.map((review: ReviewListItemResponse) => review.commentPreview).join('\n');

        const summaryResponse = await this.aiService.textGenerateFromPrompt(
            reviewSummaryPrompt(reviewsText)
        );

        if (!summaryResponse.success) {
            return { success: false, error: 'Failed to get AI summary response' };
        }

        return { success: true, data: summaryResponse.data };
    }
    
    
}
