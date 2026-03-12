import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ReviewListItemResponse,
  ReviewResponse,
  ReviewStatisticsResponse,
  MediaResponse
} from 'src/application/dtos/response/review.response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from '../utils/error-handler';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { UnitOfWork } from '../repositories/unit-of-work';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';
import { AIHelper } from '../helpers/ai.helper';
import { AI_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { reviewSummaryPrompt, INSTRUCTION_TYPE_REVIEW } from 'src/application/constant/prompts';
import {
  isArrayEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from '../utils/insufficient-data';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  AIReviewSummaryStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';

const reviewInclude = {
  AspNetUsers_Reviews_UserIdToAspNetUsers: {
    include: { Media: true }
  },
  OrderDetails: {
    include: {
      ProductVariants: {
        include: {
          Products: true,
          Concentrations: true
        }
      }
    }
  },
  Media: true
} satisfies Prisma.ReviewsInclude;

type ReviewWithRelations = Prisma.ReviewsGetPayload<{
  include: typeof reviewInclude;
}>;

function buildVariantName(review: ReviewWithRelations): string {
  const v = review.OrderDetails.ProductVariants;
  return `${v.Products.Name} ${v.VolumeMl}ml ${v.Concentrations.Name}`;
}

function mapToReviewResponse(review: ReviewWithRelations): ReviewResponse {
  return {
    id: review.Id,
    userId: review.UserId,
    userFullName: review.AspNetUsers_Reviews_UserIdToAspNetUsers.FullName,
    userProfilePictureUrl:
      review.AspNetUsers_Reviews_UserIdToAspNetUsers.Media?.Url ?? null,
    orderDetailId: review.OrderDetailId,
    variantId: review.OrderDetails.VariantId,
    variantName: buildVariantName(review),
    rating: review.Rating,
    comment: review.Comment,
    status: review.Status as 'Pending' | 'Approved' | 'Rejected',
    images: review.Media.map(
      (m): MediaResponse => ({
        id: m.Id,
        url: m.Url,
        altText: m.AltText ?? null,
        displayOrder: m.DisplayOrder,
        isPrimary: m.IsPrimary,
        fileSize: m.FileSize != null ? Number(m.FileSize) : null,
        mimeType: m.MimeType ?? null
      })
    ),
    createdAt: review.CreatedAt.toISOString(),
    updatedAt: review.UpdatedAt?.toISOString() ?? null
  };
}

function mapToReviewListItemResponse(
  review: ReviewWithRelations
): ReviewListItemResponse {
  return {
    id: review.Id,
    userId: review.UserId,
    userFullName: review.AspNetUsers_Reviews_UserIdToAspNetUsers.FullName,
    userProfilePictureUrl:
      review.AspNetUsers_Reviews_UserIdToAspNetUsers.Media?.Url ?? null,
    variantId: review.OrderDetails.VariantId,
    variantName: buildVariantName(review),
    rating: review.Rating,
    status: review.Status as 'Pending' | 'Approved' | 'Rejected',
    commentPreview: review.Comment.substring(0, 100),
    imageCount: review.Media.length,
    createdAt: review.CreatedAt.toISOString()
  };
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService
  ) {}

  async getAllReviews(
    request: GetPagedReviewRequest
  ): Promise<BaseResponseAPI<PagedResult<ReviewListItemResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const where: Prisma.ReviewsWhereInput = {
          ...(request.VariantId
            ? { OrderDetails: { VariantId: request.VariantId } }
            : {}),
          ...(request.UserId ? { UserId: request.UserId } : {}),
          ...(request.Status ? { Status: request.Status } : {}),
          ...(request.MinRating || request.MaxRating
            ? {
              Rating: {
                ...(request.MinRating ? { gte: request.MinRating } : {}),
                ...(request.MaxRating ? { lte: request.MaxRating } : {})
              }
            }
            : {}),
          ...(request.HasImages ? { Media: { some: {} } } : {})
        };

        const [reviews, totalCount] = await Promise.all([
          this.prisma.reviews.findMany({
            where,
            skip,
            take,
            include: reviewInclude
          }),
          this.prisma.reviews.count({ where })
        ]);

        const result = new PagedResult<ReviewListItemResponse>({
          items: reviews.map(mapToReviewListItemResponse),
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / request.PageSize)
        });
        return { success: true, payload: result };
      },
      'Failed to fetch reviews',
      true
    );
  }

  async getReviewsByVariantId(
    variantId: string
  ): Promise<BaseResponseAPI<ReviewResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const reviews = await this.prisma.reviews.findMany({
          where: { OrderDetails: { VariantId: variantId } },
          include: reviewInclude
        });
        return { success: true, payload: reviews.map(mapToReviewResponse) };
      },
      'Failed to fetch reviews',
      true
    );
  }

  async getReviewStatisticByVariantId(
    variantId: string
  ): Promise<BaseResponseAPI<ReviewStatisticsResponse>> {
    return await funcHandlerAsync(
      async () => {
        const reviews = await this.prisma.reviews.findMany({
          where: { OrderDetails: { VariantId: variantId } },
          select: { Rating: true }
        });

        const totalReviews = reviews.length;
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((sum, r) => sum + r.Rating, 0) / totalReviews
            : 0;

        const countByRating = reviews.reduce(
          (acc, r) => {
            acc[r.Rating] = (acc[r.Rating] ?? 0) + 1;
            return acc;
          },
          {} as Record<number, number>
        );

        const stats: ReviewStatisticsResponse = {
          variantId,
          totalReviews,
          averageRating: Math.round(averageRating * 100) / 100,
          fiveStarCount: countByRating[5] ?? 0,
          fourStarCount: countByRating[4] ?? 0,
          threeStarCount: countByRating[3] ?? 0,
          twoStarCount: countByRating[2] ?? 0,
          oneStarCount: countByRating[1] ?? 0
        };
        return { success: true, payload: stats };
      },
      'Failed to fetch review statistics',
      true
    );
  }

  async addReviewLog(
    type: ReviewTypeEnum,
    variantId: string | null,
    reviewLog: string
  ): Promise<BaseResponseAPI<ReviewLog>> {
    return await funcHandlerAsync(
      async () => {
        const log = new ReviewLog({
          typeReview: type,
          ...(variantId ? { variantId } : {}),
          reviewLog
        });
        const result = await this.unitOfWork.ReviewLogRepo.insert(log);
        return { success: true, payload: result };
      },
      'Failed to add review log',
      true
    );
  }

  async getReviewLogsByVariantId(
    variantId: string
  ): Promise<BaseResponseAPI<ReviewLog[]>> {
    return await funcHandlerAsync(
      async () => {
        const logs = await this.unitOfWork.ReviewLogRepo.find({ variantId });
        return { success: true, payload: logs };
      },
      'Failed to fetch review logs',
      true
    );
  }

  async getReviewLogById(id: string): Promise<BaseResponseAPI<ReviewLog>> {
    return await funcHandlerAsync(
      async () => {
        const log = await this.unitOfWork.ReviewLogRepo.findOne({ id });
        if (!log) {
          return { success: false, error: 'Review log not found' };
        }
        return { success: true, payload: log };
      },
      'Failed to fetch review log',
      true
    );
  }

  async getAllReviewLogs(): Promise<BaseResponseAPI<ReviewLog[]>> {
    return await funcHandlerAsync(
      async () => {
        const result = await this.unitOfWork.ReviewLogRepo.findAll({ orderBy: { updatedAt: 'DESC' } });
        return { success: true, payload: result };
      },
      'Failed to fetch review logs',
      true
    );
  }

  async generateReviewSummaryAll(): Promise<BaseResponse<string>> {
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);
    const summaryResponse = await this.aiHelper.textGenerateFromPrompt('', adminPrompt);
    if (!summaryResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI summary response', {
        service: 'AIHelper',
        endpoint: 'reviews/summary/all'
      });
    }
    await this.addReviewLog(ReviewTypeEnum.ALL, null, summaryResponse.data ?? '').catch(err => {
      console.error('Failed to save review summary log (ALL):', err);
    });
    return Ok(summaryResponse.data);
  }

  async generateReviewSummaryByVariantId(variantId: string): Promise<BaseResponse<string>> {
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);
    const summaryResponse = await this.aiHelper.textGenerateFromPrompt('ID variant: ' + variantId, adminPrompt);
    if (!summaryResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI summary response', {
        variantId,
        service: 'AIHelper',
        endpoint: 'reviews/summary/:variantId'
      });
    }
    await this.addReviewLog(ReviewTypeEnum.ID, variantId, summaryResponse.data ?? '').catch(err => {
      console.error(`Failed to save review summary log for variant ${variantId}:`, err);
    });
    return Ok(summaryResponse.data);
  }

  async generateStructuredReviewSummary(
    variantId: string
  ): Promise<BaseResponse<AIReviewSummaryStructuredResponse>> {
    const startTime = Date.now();
    const reviewsResponse = await this.getReviewsByVariantId(variantId);
    if (!reviewsResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to fetch reviews', {
        variantId,
        service: 'ReviewService',
        endpoint: 'reviews/summary/structured/:variantId'
      });
    }
    const reviews = reviewsResponse.payload ?? [];
    if (isArrayEmpty(reviews)) {
      return Ok(new AIReviewSummaryStructuredResponse({
        summary: INSUFFICIENT_DATA_MESSAGES.REVIEW_SUMMARY,
        variantId,
        reviewCount: 0,
        generatedAt: new Date(),
        metadata: new AIResponseMetadata({ processingTimeMs: Date.now() - startTime })
      }));
    }
    const reviewsText = reviews.map((r: ReviewResponse) => r.comment).join('\n');
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_REVIEW);
    const summaryResponse = await this.aiHelper.textGenerateFromPrompt(
      reviewSummaryPrompt(reviewsText),
      adminPrompt
    );
    if (!summaryResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI summary response', {
        variantId,
        service: 'AIHelper',
        endpoint: 'reviews/summary/structured/:variantId'
      });
    }
    await this.addReviewLog(ReviewTypeEnum.ID, variantId, summaryResponse.data ?? '').catch(err => {
      console.error(`Failed to save structured review summary log for variant ${variantId}:`, err);
    });
    return Ok(new AIReviewSummaryStructuredResponse({
      summary: summaryResponse.data ?? '',
      variantId,
      reviewCount: reviews.length,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs: Date.now() - startTime })
    }));
  }
}
