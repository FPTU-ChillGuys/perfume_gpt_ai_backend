import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import {
  NatsReviewPagedResponse,
  NatsReviewListItemResponse,
  NatsReviewVariantStats
} from 'src/application/dtos/response/nats/nats-review.response';

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
  }): Promise<NatsReviewPagedResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('review.get_paged')}`);
    return await this.natsRpc.sendRequest<NatsReviewPagedResponse>(
      REVIEW_REQUEST_CHANNEL,
      'getList',
      params,
      DEFAULT_TIMEOUT,
    );
  }

  /**
   * Lấy toàn bộ đánh giá của một variant (không phân trang).
   */
  async getVariantReviews(variantId: string): Promise<NatsReviewListItemResponse[]> {
    this.logger.log(`[NATS] ${this.i18n.t('review.get_by_variant')}: ${variantId}`);
    return await this.natsRpc.sendRequest<NatsReviewListItemResponse[]>(
      REVIEW_REQUEST_CHANNEL,
      'getVariantReviews',
      { variantId },
      DEFAULT_TIMEOUT,
    );
  }

  /**
   * Lấy thống kê đánh giá của một variant.
   */
  async getVariantStats(variantId: string): Promise<NatsReviewVariantStats> {
    this.logger.log(`[NATS] ${this.i18n.t('review.get_stats')}: ${variantId}`);
    return await this.natsRpc.sendRequest<NatsReviewVariantStats>(
      REVIEW_REQUEST_CHANNEL,
      'getStats',
      { variantId },
      DEFAULT_TIMEOUT,
    );
  }
}
