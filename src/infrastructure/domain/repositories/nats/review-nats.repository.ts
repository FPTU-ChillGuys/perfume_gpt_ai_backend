import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { I18nService } from 'nestjs-i18n';

const REVIEW_REQUEST_CHANNEL = 'review_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class ReviewNatsRepository {
  private readonly logger = new Logger(ReviewNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

  /**
   * Fetch paged review data from the main backend.
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
  }) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_reviews', { args: { params: JSON.stringify(params) } }));
    return await this.natsRpc.sendRequest<any>(
      REVIEW_REQUEST_CHANNEL,
      'getList',
      params,
      DEFAULT_TIMEOUT
    );
  }

  /**
   * Fetch all reviews for a specific variant (unpaged).
   */
  async getVariantReviews(variantId: string) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_variant_reviews', { args: { variantId } }));
    return await this.natsRpc.sendRequest<any[]>(
      REVIEW_REQUEST_CHANNEL,
      'getVariantReviews',
      { variantId },
      DEFAULT_TIMEOUT
    );
  }

  /**
   * Fetch review statistics for a specific variant.
   */
  async getVariantStats(variantId: string) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_variant_stats', { args: { variantId } }));
    return await this.natsRpc.sendRequest<any>(
      REVIEW_REQUEST_CHANNEL,
      'getStats',
      { variantId },
      DEFAULT_TIMEOUT
    );
  }
}
