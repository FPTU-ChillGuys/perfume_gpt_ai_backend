import { Injectable, Logger } from '@nestjs/common';
import { RedisRequestResponseService } from 'src/infrastructure/domain/common/redis/redis-request-response.service';

const REVIEW_REQUEST_CHANNEL = 'review_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class ReviewRedisRepository {
  private readonly logger = new Logger(ReviewRedisRepository.name);

  constructor(private readonly redisRequestResponse: RedisRequestResponseService) {}

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
    this.logger.log(`Fetching paged review data: ${JSON.stringify(params)}`);
    return await this.redisRequestResponse.sendRequest<any>(
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
    this.logger.log(`Fetching all reviews for variantId=${variantId}`);
    return await this.redisRequestResponse.sendRequest<any[]>(
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
    this.logger.log(`Fetching review stats for variantId=${variantId}`);
    return await this.redisRequestResponse.sendRequest<any>(
      REVIEW_REQUEST_CHANNEL,
      'getStats',
      { variantId },
      DEFAULT_TIMEOUT
    );
  }
}
