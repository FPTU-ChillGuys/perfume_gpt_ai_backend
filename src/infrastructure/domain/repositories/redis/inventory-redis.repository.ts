import { Injectable, Logger } from '@nestjs/common';
import { RedisRequestResponseService } from 'src/infrastructure/domain/common/redis/redis-request-response.service';

const INVENTORY_REQUEST_CHANNEL = 'inventory_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class InventoryRedisRepository {
  private readonly logger = new Logger(InventoryRedisRepository.name);

  constructor(private readonly redisRequestResponse: RedisRequestResponseService) {}

  /**
   * Fetch paged stock data from the main backend.
   */
  async getPagedStock(params: {
    pageNumber?: number;
    pageSize?: number;
    searchTerm?: string;
    isLowStock?: boolean;
    stockStatus?: number; // 1=OutOfStock, 2=LowStock, 3=Normal (StockStatus enum)
    variantId?: string;
  }) {
    this.logger.log(`Fetching paged stock data: ${JSON.stringify(params)}`);
    return await this.redisRequestResponse.sendRequest<any>(
      INVENTORY_REQUEST_CHANNEL,
      'getInventory',
      params,
      DEFAULT_TIMEOUT
    );
  }

  /**
   * Fetch paged batch data from the main backend.
   */
  async getPagedBatches(params: {
    pageNumber?: number;
    pageSize?: number;
    batchCode?: string;
    isExpired?: boolean;
    variantId?: string;
  }) {
    this.logger.log(`Fetching paged batch data: ${JSON.stringify(params)}`);
    return await this.redisRequestResponse.sendRequest<any>(
      INVENTORY_REQUEST_CHANNEL,
      'getBatches',
      params,
      DEFAULT_TIMEOUT
    );
  }

  /**
   * Fetch overall inventory statistics.
   */
  async getOverallStats() {
    this.logger.log('Fetching overall inventory stats');
    return await this.redisRequestResponse.sendRequest<any>(
      INVENTORY_REQUEST_CHANNEL,
      'getOverallStats',
      {},
      DEFAULT_TIMEOUT
    );
  }
}
