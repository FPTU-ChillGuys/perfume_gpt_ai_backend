import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ReviewListItemResponse } from 'src/application/dtos/response/review.response';

/** Thống kê đánh giá của một variant */
export interface ReviewVariantStats {
  variantId: string;
  totalReviews: number;
  averageRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
}

const REVIEW_REQUEST_CHANNEL = 'review_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class ReviewNatsRepository {
  private readonly logger = new Logger(ReviewNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Lấy danh sách đánh giá phân trang.
   */
  async getPagedReviews(params: {
    pageNumber?: number;
    pageSize?: number;
    variantId?: string;
    userId?: string;
    status?: string;
    minRating?: number;
    maxRating?: number;
    hasImages?: boolean;
  }): Promise<PagedResult<ReviewListItemResponse>> {
    this.logger.log(`[NATS] ${this.i18n.t('review.get_paged')}`);
    return await this.natsRpc.sendRequest<PagedResult<ReviewListItemResponse>>(
      REVIEW_REQUEST_CHANNEL,
      'getList',
      params,
      DEFAULT_TIMEOUT,
    );
  }

  /**
   * Lấy toàn bộ đánh giá của một variant (không phân trang).
   */
  async getVariantReviews(variantId: string): Promise<ReviewListItemResponse[]> {
    this.logger.log(`[NATS] ${this.i18n.t('review.get_by_variant')}: ${variantId}`);
    return await this.natsRpc.sendRequest<ReviewListItemResponse[]>(
      REVIEW_REQUEST_CHANNEL,
      'getVariantReviews',
      { variantId },
      DEFAULT_TIMEOUT,
    );
  }

  /**
   * Lấy thống kê đánh giá của một variant.
   */
  async getVariantStats(variantId: string): Promise<ReviewVariantStats> {
    this.logger.log(`[NATS] ${this.i18n.t('review.get_stats')}: ${variantId}`);
    return await this.natsRpc.sendRequest<ReviewVariantStats>(
      REVIEW_REQUEST_CHANNEL,
      'getStats',
      { variantId },
      DEFAULT_TIMEOUT,
    );
  }
}
