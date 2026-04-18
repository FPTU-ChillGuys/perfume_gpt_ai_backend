import { Injectable, Logger } from '@nestjs/common';
import { RedisRequestResponseService } from '../common/redis/redis-request-response.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { CatalogItemResponse } from 'src/application/dtos/response/catalog-item.response';

const CATALOG_REQUEST_CHANNEL = 'catalog_request';

@Injectable()
export class SourcingCatalogService {
  private readonly logger = new Logger(SourcingCatalogService.name);

  constructor(private readonly redisRequestResponseService: RedisRequestResponseService) {}

  /**
   * Fetches catalogs for a specific product variant from the main backend via Redis.
   * @param variantId The GUID of the product variant.
   */
  async getCatalogsAsync(variantId: string): Promise<BaseResponseAPI<CatalogItemResponse[]>> {
    try {
      this.logger.log(`[Sourcing] Requesting catalogs for variantId=${variantId}`);

      const response = await this.redisRequestResponseService.sendRequest<{
        variantId: string;
        catalogs: any[];
        error?: string;
      }>(CATALOG_REQUEST_CHANNEL, { variantId });

      if (response.error) {
        return {
          success: false,
          error: response.error,
          payload: [],
        };
      }

      const catalogs = (response.catalogs || []).map(
        (item) => new CatalogItemResponse(item),
      );

      return {
        success: true,
        payload: catalogs,
      };
    } catch (err) {
      this.logger.error(`[Sourcing] Failed to get catalogs for variantId=${variantId}: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Timeout or internal error requesting catalogs via Redis.',
        payload: [],
      };
    }
  }
}
