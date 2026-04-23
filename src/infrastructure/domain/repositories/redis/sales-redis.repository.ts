import { Injectable, Logger } from '@nestjs/common';
import { RedisRequestResponseService } from 'src/infrastructure/domain/common/redis/redis-request-response.service';

const SALES_REQUEST_CHANNEL = 'sales_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class SalesRedisRepository {
  private readonly logger = new Logger(SalesRedisRepository.name);

  constructor(private readonly redisRequestResponse: RedisRequestResponseService) {}

  /**
   * Fetch variant sales analytics from the main backend.
   * @param months Number of months to analyze (default is 2)
   */
  async getVariantSalesAnalytics(months = 2) {
    this.logger.log(`Fetching variant sales analytics for ${months} months`);
    return await this.redisRequestResponse.sendRequest<unknown>(
      SALES_REQUEST_CHANNEL,
      'getSalesAnalytics',
      { months },
      DEFAULT_TIMEOUT
    );
  }
}
