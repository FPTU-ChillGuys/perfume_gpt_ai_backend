import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import {
  NatsInventoryPagedResponse,
  NatsInventoryOverallStats
} from 'src/application/dtos/response/nats/nats-inventory.response';

const INVENTORY_REQUEST_CHANNEL = 'inventory_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class InventoryNatsRepository {
  private readonly logger = new Logger(InventoryNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Lấy danh sách tồn kho phân trang từ .NET backend.
   */
  async getPagedStock(params: {
    pageNumber?: number;
    pageSize?: number;
    searchTerm?: string;
    isLowStock?: boolean;
    stockStatus?: number;
    variantId?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<NatsInventoryPagedResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('inventory.get_stock')}`);
    return await this.natsRpc.sendRequest<NatsInventoryPagedResponse>(
      INVENTORY_REQUEST_CHANNEL,
      'getInventory',
      params,
      DEFAULT_TIMEOUT,
    );
  }

  /**
   * Lấy danh sách lô hàng phân trang từ .NET backend.
   */
  async getPagedBatches(params: {
    pageNumber?: number;
    pageSize?: number;
    batchCode?: string;
    isExpired?: boolean;
    variantId?: string;
  }): Promise<PagedResult<BatchResponse>> {
    this.logger.log(`[NATS] ${this.i18n.t('inventory.get_batches')}: variantId=${params.variantId || 'all'}`);
    const result = await this.natsRpc.sendRequest<PagedResult<BatchResponse>>(
      INVENTORY_REQUEST_CHANNEL,
      'getBatches',
      params,
      DEFAULT_TIMEOUT,
    );
    this.logger.log(`[NATS] ${this.i18n.t('inventory.get_batches')} result: totalCount=${result?.totalCount || 0}, itemsCount=${result?.items?.length || 0}`);
    return result;
  }

  /**
   * Lấy thống kê tổng quan tồn kho.
   */
  async getOverallStats(): Promise<NatsInventoryOverallStats> {
    this.logger.log(`[NATS] ${this.i18n.t('inventory.get_stats')}`);
    return await this.natsRpc.sendRequest<NatsInventoryOverallStats>(
      INVENTORY_REQUEST_CHANNEL,
      'getOverallStats',
      {},
      DEFAULT_TIMEOUT,
    );
  }
}
