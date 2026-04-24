import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';

/** Kết quả trả về từ .NET Handler (raw .Payload): PagedResult<ProductWithVariantsResponse> */
export type ProductPagedPayload = PagedResult<ProductWithVariantsResponse>;

/** Kết quả trả về từ getByIds: { items: ProductWithVariantsResponse[] } */
export interface ProductByIdsPayload {
  items: ProductWithVariantsResponse[];
}

const PRODUCT_REQUEST_CHANNEL = 'product_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class ProductNatsRepository {
  private readonly logger = new Logger(ProductNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  async getByStructuredQuery(analysis: unknown): Promise<ProductPagedPayload> {
    this.logger.log(`[NATS] ${this.i18n.t('product.get_by_query')}`);
    return await this.natsRpc.sendRequest<ProductPagedPayload>(
      PRODUCT_REQUEST_CHANNEL,
      'getByStructuredQuery',
      analysis,
      DEFAULT_TIMEOUT,
    );
  }

  async getBestSelling(params: unknown): Promise<ProductPagedPayload> {
    this.logger.log(`[NATS] ${this.i18n.t('product.get_best_selling')}`);
    return await this.natsRpc.sendRequest<ProductPagedPayload>(
      PRODUCT_REQUEST_CHANNEL,
      'getBestSelling',
      params,
      DEFAULT_TIMEOUT,
    );
  }

  async getNewest(params: unknown): Promise<ProductPagedPayload> {
    this.logger.log(`[NATS] ${this.i18n.t('product.get_newest')}`);
    return await this.natsRpc.sendRequest<ProductPagedPayload>(
      PRODUCT_REQUEST_CHANNEL,
      'getNewest',
      params,
      DEFAULT_TIMEOUT,
    );
  }

  async getProductsByIds(ids: string[]): Promise<ProductByIdsPayload> {
    this.logger.log(`[NATS] ${this.i18n.t('product.get_by_ids')}: ${ids.length} items`);
    return await this.natsRpc.sendRequest<ProductByIdsPayload>(
      PRODUCT_REQUEST_CHANNEL,
      'getByIds',
      { ids },
      DEFAULT_TIMEOUT,
    );
  }
}
