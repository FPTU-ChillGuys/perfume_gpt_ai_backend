import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { VariantSalesAnalyticsResponse } from 'src/application/dtos/response/variant-sales-analytics.response';

const SALES_REQUEST_CHANNEL = 'sales_data_request';
const DEFAULT_TIMEOUT = 15000;

@Injectable()
export class SalesNatsRepository {
  private readonly logger = new Logger(SalesNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Lấy dữ liệu phân tích bán hàng theo variant từ .NET backend.
   * @param months Số tháng phân tích (mặc định 2)
   */
  async getVariantSalesAnalytics(months = 2): Promise<VariantSalesAnalyticsResponse[]> {
    this.logger.log(`[NATS] ${this.i18n.t('sales.get_analytics')}: ${months} months`);
    return await this.natsRpc.sendRequest<VariantSalesAnalyticsResponse[]>(
      SALES_REQUEST_CHANNEL,
      'getSalesAnalytics',
      { months },
      DEFAULT_TIMEOUT,
    );
  }
}
