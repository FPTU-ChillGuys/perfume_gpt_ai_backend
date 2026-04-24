import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from '../common/nats/nats-rpc.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { CatalogItemResponse } from 'src/application/dtos/response/catalog-item.response';
import { I18nService } from 'nestjs-i18n';

const CATALOG_REQUEST_CHANNEL = 'catalog_request';

@Injectable()
export class SourcingCatalogService {
  private readonly logger = new Logger(SourcingCatalogService.name);

  constructor(
    private readonly natsRpcService: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

  /**
   * Fetches catalogs for a specific product variant from the main backend via NATS.
   * @param variantId The GUID of the product variant.
   */
  async getCatalogsAsync(variantId: string): Promise<BaseResponseAPI<CatalogItemResponse[]>> {
    try {
      this.logger.log(this.i18n.t('common.nats.repository.requesting_catalogs', { args: { variantId } }));

      const response = await this.natsRpcService.sendRequest<{
        variantId: string;
        catalogs: any[];
        error?: string;
      }>(CATALOG_REQUEST_CHANNEL, 'getCatalogs', { variantId });

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
      this.logger.error(this.i18n.t('common.nats.repository.sourcing_error', { args: { variantId, error: err.message } }));
      return {
        success: false,
        error: err.message || this.i18n.t('common.nats.repository.sourcing_internal_error'),
        payload: [],
      };
    }
  }
}
