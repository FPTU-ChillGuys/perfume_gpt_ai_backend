import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { I18nService } from 'nestjs-i18n';

const SALES_REQUEST_CHANNEL = 'sales_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class SalesNatsRepository {
  private readonly logger = new Logger(SalesNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

  /**
   * Fetch variant sales analytics from the main backend.
   * @param months Number of months to analyze (default is 2)
   */
  async getVariantSalesAnalytics(months = 2) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_sales_analytics', { args: { months } }));
    return await this.natsRpc.sendRequest<unknown>(
      SALES_REQUEST_CHANNEL,
      'getSalesAnalytics',
      { months },
      DEFAULT_TIMEOUT
    );
  }
}
