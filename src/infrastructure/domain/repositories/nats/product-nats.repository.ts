import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { I18nService } from 'nestjs-i18n';

const PRODUCT_REQUEST_CHANNEL = 'product_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class ProductNatsRepository {
  private readonly logger = new Logger(ProductNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

  async getByStructuredQuery(analysis: any) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_structured', { args: { intent: JSON.stringify(analysis.intent) } }));
    return await this.natsRpc.sendRequest<any>(
      PRODUCT_REQUEST_CHANNEL,
      'getByStructuredQuery',
      analysis,
      DEFAULT_TIMEOUT
    );
  }

  async getBestSelling(params: any) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_best_selling', { args: { params: JSON.stringify(params) } }));
    return await this.natsRpc.sendRequest<any>(
      PRODUCT_REQUEST_CHANNEL,
      'getBestSelling',
      params,
      DEFAULT_TIMEOUT
    );
  }

  async getNewest(params: any) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_newest', { args: { params: JSON.stringify(params) } }));
    return await this.natsRpc.sendRequest<any>(
      PRODUCT_REQUEST_CHANNEL,
      'getNewest',
      params,
      DEFAULT_TIMEOUT
    );
  }

  async getProductsByIds(ids: string[]) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_by_ids', { args: { count: ids.length } }));
    return await this.natsRpc.sendRequest<any>(
      PRODUCT_REQUEST_CHANNEL,
      'getByIds',
      { ids },
      DEFAULT_TIMEOUT
    );
  }
}
