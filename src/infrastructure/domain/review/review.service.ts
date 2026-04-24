import { Injectable } from '@nestjs/common';
import { ReviewNatsRepository } from '../repositories/nats/review-nats.repository';
import {
  ReviewListItemResponse,
  ReviewResponse,
  ReviewStatisticsResponse,
  MediaResponse
} from 'src/application/dtos/response/review.response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewNatsRepo: ReviewNatsRepository,
    private readonly unitOfWork: UnitOfWork
  ) {}
  
  async getAllReviews(
    request: GetPagedReviewRequest
  ): Promise<BaseResponseAPI<PagedResult<ReviewListItemResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const payload = await this.reviewNatsRepo.getPagedReviews({
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          variantId: request.VariantId,
          userId: request.UserId,
          status: request.Status,
          minRating: request.MinRating,
          maxRating: request.MaxRating,
          hasImages: request.HasImages
        });

        const result = new PagedResult<ReviewListItemResponse>({
          items: (payload?.items || []).map(r => new ReviewListItemResponse(r)),
          pageNumber: payload?.pageNumber || request.PageNumber,
          pageSize: payload?.pageSize || request.PageSize,
          totalCount: payload?.totalCount || 0,
          totalPages: payload?.totalPages || 0
        });

        return { success: true, payload: result };
      },
      'Failed to fetch reviews from Redis',
      true
    );
  }

  async getReviewsByVariantId(
    variantId: string
  ): Promise<BaseResponseAPI<ReviewResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        if (!isUUID(variantId)) return { success: true, payload: [] };
        
        const reviews = await this.reviewNatsRepo.getVariantReviews(variantId);

        return { success: true, payload: (reviews || []).map(r => new ReviewResponse(r)) };
      },
      'Failed to fetch variant reviews from Redis via Repository',
      true
    );
  }

  async getReviewStatisticByVariantId(
    variantId: string
  ): Promise<BaseResponseAPI<ReviewStatisticsResponse>> {
    return await funcHandlerAsync(
      async () => {
        if (!isUUID(variantId)) {
          return {
            success: true,
            payload: {
              variantId,
              totalReviews: 0,
              averageRating: 0,
              fiveStarCount: 0,
              fourStarCount: 0,
              threeStarCount: 0,
              twoStarCount: 0,
              oneStarCount: 0
            }
          };
        }

        const stats = await this.reviewNatsRepo.getVariantStats(variantId);

        const response: ReviewStatisticsResponse = {
          variantId,
          totalReviews: stats?.totalReviews || 0,
          averageRating: stats?.averageRating || 0,
          fiveStarCount: stats?.fiveStarCount || 0,
          fourStarCount: stats?.fourStarCount || 0,
          threeStarCount: stats?.threeStarCount || 0,
          twoStarCount: stats?.twoStarCount || 0,
          oneStarCount: stats?.oneStarCount || 0
        };

        return { success: true, payload: response };
      },
      'Failed to fetch review statistics from Redis',
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

  async getLatestReviewLogByVariantId(
    variantId: string
  ): Promise<BaseResponseAPI<ReviewLog | null>> {
    return await funcHandlerAsync(
      async () => {
        const log = await this.unitOfWork.ReviewLogRepo.findOne(
          { variantId },
          { orderBy: { createdAt: 'DESC' } }
        );
        if (!log) {
          return { success: true, payload: null };
        }
        return { success: true, payload: log };
      },
      'Failed to fetch latest review log',
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

  /** Lấy toàn bộ review không phân trang qua Redis Repository – dùng cho AI summary */
  async getReviewsUnpaged(variantId?: string): Promise<ReviewResponse[]> {
    const reviews = await this.reviewNatsRepo.getVariantReviews(variantId!);
    return (reviews || []).map(r => new ReviewResponse(r));
  }
}
