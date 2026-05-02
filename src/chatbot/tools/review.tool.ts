import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class ReviewTool {
  private readonly logger = new Logger(ReviewTool.name);

  constructor(
    private readonly reviewService: ReviewService,
    private readonly err: I18nErrorHandler
  ) {}

  /**
   * Lấy danh sách review của một variant sản phẩm.
   * AI dùng tool này khi user hỏi về đánh giá của một sản phẩm cụ thể.
   */
  getReviewsByVariantId: Tool = tool({
    description:
      'Get all customer reviews for a specific product variant. ' +
      'Returns review content, rating, user info, and attached images. ' +
      'Large review lists are TOON-compressed to optimize token usage. ' +
      'Use this when the user asks about opinions, feedback, or reviews for a product.',
    inputSchema: z.object({
      variantId: z
        .string()
        .describe('The ID of the product variant to fetch reviews for')
    }),
    execute: async (input) => {
      this.logger.log(
        `[getReviewsByVariantId] called for variantId: ${input.variantId}`
      );
      return await this.err.wrap(async () => {
        const response = await this.reviewService.getReviewsByVariantId(
          input.variantId
        );
        if (!response.success) {
          return {
            success: false,
            error: `Failed to fetch reviews for variant ${input.variantId}.`
          };
        }

        const reviews = response.payload ?? [];

        if (Array.isArray(reviews) && reviews.length > 5) {
          const encodingResult = encodeToolOutput(reviews);
          return {
            success: true,
            encodedData: encodingResult.encoded
          };
        }

        return { success: true, data: reviews };
      }, 'errors.review.tool_reviews');
    }
  });

  /**
   * Lấy thống kê đánh giá của một variant sản phẩm.
   * AI dùng tool này khi user hỏi về điểm trung bình, tổng số sao, v.v.
   */
  getReviewStatisticsByVariantId: Tool = tool({
    description:
      'Get review statistics for a specific product variant. ' +
      'Returns total number of reviews, average rating, and star distribution (1–5 stars). ' +
      'Use this when the user asks about overall rating, review count, or score of a product.',
    inputSchema: z.object({
      variantId: z
        .string()
        .describe('The ID of the product variant to fetch statistics for')
    }),
    execute: async (input) => {
      this.logger.log(
        `[getReviewStatisticsByVariantId] called for variantId: ${input.variantId}`
      );
      return await this.err.wrap(async () => {
        const response = await this.reviewService.getReviewStatisticByVariantId(
          input.variantId
        );
        if (!response.success) {
          return {
            success: false,
            error: `Failed to fetch review statistics for variant ${input.variantId}.`
          };
        }
        return { success: true, data: response.payload ?? null };
      }, 'errors.review.tool_statistics');
    }
  });

  /**
   * Lấy danh sách review có phân trang và lọc theo nhiều điều kiện.
   * AI dùng tool này khi cần lọc review theo user, trạng thái, hoặc rating.
   */
  getPagedReviews: Tool = tool({
    description:
      'Get a paginated list of reviews with optional filters. ' +
      'Can filter by variantId, userId, approval status (Pending/Approved/Rejected), ' +
      'minimum/maximum rating, or whether the review has images. ' +
      'Large datasets are TOON-compressed to optimize token usage. ' +
      'Use this when the user wants to browse or compare multiple reviews.',
    inputSchema: z.object({
      pageNumber: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(50).optional().default(10),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
      isDescending: z.boolean().optional().default(false),
      variantId: z.string().optional().describe('Filter by product variant ID'),
      userId: z.string().optional().describe('Filter by user ID'),
      status: z
        .enum(['Pending', 'Approved', 'Rejected'])
        .optional()
        .describe('Filter by review approval status'),
      minRating: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe('Minimum star rating (1–5)'),
      maxRating: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe('Maximum star rating (1–5)'),
      hasImages: z
        .boolean()
        .optional()
        .describe('Only return reviews that have attached images')
    }),
    execute: async (input) => {
      this.logger.log(`[getPagedReviews] called`);
      return await this.err.wrap(async () => {
        const response = await this.reviewService.getAllReviews({
          PageNumber: input.pageNumber,
          PageSize: input.pageSize,
          SortOrder: input.sortOrder,
          IsDescending: input.isDescending,
          VariantId: input.variantId,
          UserId: input.userId,
          Status: input.status,
          MinRating: input.minRating,
          MaxRating: input.maxRating,
          HasImages: input.hasImages
        });
        if (!response.success) {
          return { success: false, error: 'Failed to fetch paged reviews.' };
        }

        const data = response.payload ?? null;
        if (Array.isArray(data) && data.length > 5) {
          const encodingResult = encodeToolOutput(data);
          return {
            success: true,
            encodedData: encodingResult.encoded
          };
        }

        return { success: true, data };
      }, 'errors.review.tool_paged');
    }
  });

  /**
   * Lấy tóm tắt đánh giá mới nhất của một variant sản phẩm.
   * AI dùng tool này để có cái nhìn tổng quan nhanh về phản hồi của khách hàng.
   */
  getLatestReviewSummaryByVariantId: Tool = tool({
    description:
      'Get the most recent AI-generated summary (ReviewLog) for a specific product variant. ' +
      'Returns a concise aggregation of customer sentiment, pros, and cons. ' +
      'Use this when the user (Staff) needs a quick overview of product feedback without reading individual reviews.',
    inputSchema: z.object({
      variantId: z
        .string()
        .describe('The ID of the product variant to fetch the summary for')
    }),
    execute: async (input) => {
      this.logger.log(
        `[getLatestReviewSummaryByVariantId] called for variantId: ${input.variantId}`
      );
      return await this.err.wrap(async () => {
        const response = await this.reviewService.getLatestReviewLogByVariantId(
          input.variantId
        );
        if (!response.success) {
          return {
            success: false,
            error: 'Failed to fetch the latest review summary.'
          };
        }
        if (!response.payload) {
          return {
            success: true,
            data: 'No summary available for this product yet.'
          };
        }
        return { success: true, data: response.payload.reviewLog };
      }, 'errors.review.tool_summary');
    }
  });
}
