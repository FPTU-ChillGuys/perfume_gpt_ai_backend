import { Injectable } from '@nestjs/common';
import { ReviewNatsRepository } from '../repositories/nats/review-nats.repository';
import {
  ReviewListItemResponse,
  ReviewResponse,
  ReviewStatisticsResponse,
} from 'src/application/dtos/response/review.response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';
import { I18nService } from 'nestjs-i18n';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewNatsRepo: ReviewNatsRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly i18n: I18nService
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
      this.i18n.t('common.nats.errors.fetch_reviews_failed'),
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
      this.i18n.t('common.nats.errors.fetch_variant_reviews_failed'),
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
      this.i18n.t('common.nats.errors.fetch_review_stats_failed'),
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
      this.i18n.t('common.nats.errors.add_review_log_failed'),
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
      this.i18n.t('common.nats.errors.fetch_review_logs_failed'),
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
      this.i18n.t('common.nats.errors.fetch_latest_review_log_failed'),
      true
    );
  }

  async getReviewLogById(id: string): Promise<BaseResponseAPI<ReviewLog>> {
    return await funcHandlerAsync(
      async () => {
        const log = await this.unitOfWork.ReviewLogRepo.findOne({ id });
        if (!log) {
          return { success: false, error: this.i18n.t('common.nats.errors.review_log_not_found') };
        }
        return { success: true, payload: log };
      },
      this.i18n.t('common.nats.errors.fetch_review_logs_failed'),
      true
    );
  }

  async getAllReviewLogs(): Promise<BaseResponseAPI<ReviewLog[]>> {
    return await funcHandlerAsync(
      async () => {
        const result = await this.unitOfWork.ReviewLogRepo.findAll({ orderBy: { updatedAt: 'DESC' } });
        return { success: true, payload: result };
      },
      this.i18n.t('common.nats.errors.fetch_review_logs_failed'),
      true
    );
  }

  /** Lấy toàn bộ review không phân trang qua NATS Repository – dùng cho AI summary */
  async getReviewsUnpaged(variantId?: string): Promise<ReviewResponse[]> {
    const reviews = await this.reviewNatsRepo.getVariantReviews(variantId!);
    return (reviews || []).map(r => new ReviewResponse(r));
  }
}
