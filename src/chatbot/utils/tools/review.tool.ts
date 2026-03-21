import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { ReviewService } from 'src/infrastructure/servicies/review.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import { encodeToolOutput } from '../toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class ReviewTool {
    private readonly logger = new Logger(ReviewTool.name);

    constructor(private readonly reviewService: ReviewService) { }

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
            variantId: z.string().describe('The ID of the product variant to fetch reviews for')
        }),
        execute: async (input) => {
            this.logger.log(`[getReviewsByVariantId] called for variantId: ${input.variantId}`);
            return await funcHandlerAsync(
                async () => {
                    const response = await this.reviewService.getReviewsByVariantId(input.variantId);
                    if (!response.success) {
                        return { success: false, error: `Failed to fetch reviews for variant ${input.variantId}.` };
                    }
                    
                    const reviews = response.payload ?? [];
                    
                    // Encode large datasets to optimize token usage
                    if (Array.isArray(reviews) && reviews.length > 5) {
                        const encodingResult = encodeToolOutput(reviews);
                        return {
                            success: true,
                            data: reviews,
                            encodedData: encodingResult.encoded,
                            compressionInfo: {
                                reviewCount: reviews.length,
                                originalSize: `${encodingResult.originalSize} bytes`,
                                encodedSize: `${encodingResult.encodedSize} bytes`,
                                compressionRatio: `${encodingResult.compressionRatio}%`
                            }
                        };
                    }
                    
                    return { success: true, data: reviews };
                },
                'Error occurred while fetching reviews.',
                true
            );
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
            variantId: z.string().describe('The ID of the product variant to fetch statistics for')
        }),
        execute: async (input) => {
            this.logger.log(`[getReviewStatisticsByVariantId] called for variantId: ${input.variantId}`);
            return await funcHandlerAsync(
                async () => {
                    const response = await this.reviewService.getReviewStatisticByVariantId(input.variantId);
                    if (!response.success) {
                        return { success: false, error: `Failed to fetch review statistics for variant ${input.variantId}.` };
                    }
                    return { success: true, data: response.payload ?? null };
                },
                'Error occurred while fetching review statistics.',
                true
            );
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
            minRating: z.number().min(1).max(5).optional().describe('Minimum star rating (1–5)'),
            maxRating: z.number().min(1).max(5).optional().describe('Maximum star rating (1–5)'),
            hasImages: z.boolean().optional().describe('Only return reviews that have attached images')
        }),
        execute: async (input) => {
            this.logger.log(`[getPagedReviews] called`);
            return await funcHandlerAsync(
                async () => {
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
                    // If payload is an array, optionally encode it
                    if (Array.isArray(data) && data.length > 5) {
                        const encodingResult = encodeToolOutput(data);
                        return {
                            success: true,
                            data: data,
                            encodedData: encodingResult.encoded,
                            compressionInfo: {
                                reviewCount: data.length,
                                originalSize: `${encodingResult.originalSize} bytes`,
                                encodedSize: `${encodingResult.encodedSize} bytes`,
                                compressionRatio: `${encodingResult.compressionRatio}%`
                            }
                        };
                    }
                    
                    return { success: true, data };
                },
                'Error occurred while fetching paged reviews.',
                true
            );
        }
    });
}
