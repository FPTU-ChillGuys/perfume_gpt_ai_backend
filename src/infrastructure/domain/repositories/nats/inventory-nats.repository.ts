import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { I18nService } from 'nestjs-i18n';

const INVENTORY_REQUEST_CHANNEL = 'inventory_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class InventoryNatsRepository {
  private readonly logger = new Logger(InventoryNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

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
    sortBy?: string;
    sortOrder?: string;
  }) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_stock', { args: { params: JSON.stringify(params) } }));
    return await this.natsRpc.sendRequest<unknown>(
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
    this.logger.log(this.i18n.t('common.nats.repository.fetching_batches', { args: { params: JSON.stringify(params) } }));
    return await this.natsRpc.sendRequest<unknown>(
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
    this.logger.log(this.i18n.t('common.nats.repository.fetching_stats'));
    return await this.natsRpc.sendRequest<unknown>(
      INVENTORY_REQUEST_CHANNEL,
      'getOverallStats',
      {},
      DEFAULT_TIMEOUT
    );
  }
}
