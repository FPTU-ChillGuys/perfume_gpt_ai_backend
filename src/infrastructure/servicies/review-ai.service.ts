import { Inject, Injectable } from '@nestjs/common';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { reviewSummaryPrompt, INSTRUCTION_TYPE_REVIEW } from 'src/application/constant/prompts';
import { isArrayEmpty, INSUFFICIENT_DATA_MESSAGES } from '../utils/insufficient-data';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import {
  AIReviewSummaryStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import { AIHelper } from '../helpers/ai.helper';
import { AI_HELPER, AI_REVIEW_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { ReviewService } from './review.service';

@Injectable()
export class ReviewAIService {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly adminInstructionService: AdminInstructionService,
    @Inject(AI_REVIEW_HELPER) private readonly aiHelper: AIHelper
  ) {}

  /** Tóm tắt tất cả đánh giá bằng AI */
  async generateReviewSummaryAll(): Promise<BaseResponse<string>> {
    const reviews = await this.reviewService.getReviewsUnpaged();
    if (isArrayEmpty(reviews)) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY);
    }
    const reviewsText = reviews
      .map(r => `[${r.variantName}] ${r.userFullName} (${r.rating}★): ${r.comment}`)
      .join('\n');
    const prompt = reviewSummaryPrompt(reviewsText);
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(prompt, systemPrompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to generate review summary' };
    }
    return Ok(aiResponse.data);
  }

  /** Tóm tắt đánh giá theo variant ID bằng AI */
  async generateReviewSummaryByVariantId(variantId: string): Promise<BaseResponse<string>> {
    const reviews = await this.reviewService.getReviewsUnpaged(variantId);
    if (isArrayEmpty(reviews)) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY);
    }
    const reviewsText = reviews
      .map(r => `${r.userFullName} (${r.rating}★): ${r.comment}`)
      .join('\n');
    const prompt = reviewSummaryPrompt(reviewsText);
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(prompt, systemPrompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to generate review summary' };
    }
    return Ok(aiResponse.data);
  }

  /** Tóm tắt đánh giá có cấu trúc theo variant ID (với metadata) */
  async generateStructuredReviewSummary(
    variantId: string
  ): Promise<BaseResponse<AIReviewSummaryStructuredResponse>> {
    const startTime = Date.now();
    const reviews = await this.reviewService.getReviewsUnpaged(variantId);
    if (isArrayEmpty(reviews)) {
      throw new InternalServerErrorWithDetailsException(
        INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY,
        { variantId }
      );
    }
    const reviewsText = reviews
      .map(r => `${r.userFullName} (${r.rating}★): ${r.comment}`)
      .join('\n');
    const prompt = reviewSummaryPrompt(reviewsText);
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(prompt, systemPrompt);
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to generate structured review summary', { variantId });
    }
    const processingTimeMs = Date.now() - startTime;
    const result = new AIReviewSummaryStructuredResponse({
      summary: aiResponse.data,
      variantId,
      reviewCount: reviews.length,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({
        processingTimeMs,
        inputTokenEstimate: Math.ceil(reviewsText.length / 4)
      })
    });
    return Ok(result);
  }
}
