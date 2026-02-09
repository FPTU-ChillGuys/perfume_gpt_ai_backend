import { HttpService } from '@nestjs/axios';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { funcHandlerAsync } from '../utils/error-handler';
import ApiUrl from '../api/api_url';
import { firstValueFrom } from 'rxjs';
import { authorizationHeader } from '../utils/header';
import { Injectable } from '@nestjs/common';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BatchRequest } from 'src/application/dtos/request/batch.request';

@Injectable()
export class InventoryService {
  constructor(private readonly httpService: HttpService) {}

  //Get inventory methods here
  async getInventoryStock(
    request: InventoryStockRequest,
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<
            BaseResponseAPI<PagedResult<InventoryStockResponse>>
          >(ApiUrl().INVENTORY_URL('stock'), {
            params: {
              variantId: request.VariantId,
              searchTerm: request.SearchTerm,
              isLowStock: request.IsLowStock,
              pageNumber: request.PageNumber ?? 1,
              pageSize: request.PageSize ?? 10,
              sortBy: request.SortBy ?? '',
              sortOrder: request.SortOrder ?? 'asc',
              isDescending: request.IsDescending ?? false
            },
            headers: {
              Authorization: authorizationHeader(authHeader)
            }
          })
        );
        return data;
      },
      'Failed to fetch inventory stock',
      true
    );
  }

  //Get batch methods here
  async getBatch(
    request: BatchRequest,
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<PagedResult<BatchResponse>>>(
            ApiUrl().INVENTORY_URL('batches'),
            {
              params: {
                ...request
              },
              headers: {
                Authorization: authorizationHeader(authHeader)
              }
            }
          )
        );
        return data;
      },
      'Failed to fetch inventory stock',
      true
    );
  }

  /**
   * Tao report tu batch va stock (Lay du lieu tu 2 API tren)
   * @param authHeader 
   * @returns 
   */
  async createReportFromBatchAndStock(authHeader: string): Promise<String> {
    // Implementation for creating report from batch and stock
    const stockResponse = await this.getInventoryStock(
      new InventoryStockRequest({ PageNumber: 1, PageSize: 1000 }),
      authHeader
    );

    const batchResponse = await this.getBatch(
      new BatchRequest({ PageNumber: 1, PageSize: 1000 }),
      authHeader
    );

    const report = this.createBatchAndStockReport(
      stockResponse.payload?.items ?? [],
      batchResponse.payload?.items ?? []
    );

    return report;
  }

  createBatchReport(batchResponse: BatchResponse[]): String {
    // Implementation for creating batch report
    const batchReport = batchResponse.map((batch) => {
      return `Batch ID: ${batch.id}, Batch Code: ${batch.batchCode}, Import Quantity: ${batch.importQuantity}, Remaining Quantity: ${batch.remainingQuantity}, Manufacture Date: ${batch.manufactureDate}, Expiry Date: ${batch.expiryDate}, Created At: ${batch.createdAt}`;
    });
    return batchReport.join('\n');
  }

  createStockReport(stockResponse: InventoryStockResponse[]): String {
    // Implementation for creating stock report
    const stockReport = stockResponse.map((stock) => {
      return `Variant ID: ${stock.variantId}, Variant SKU: ${stock.variantSku}, Product Name: ${stock.productName}, Concentration: ${stock.concentrationName}, Volume: ${stock.volumeMl}ml, Stock Quantity: ${stock.totalQuantity}, Low Stock Threshold: ${stock.lowStockThreshold}, Is Low Stock: ${stock.isLowStock}`;
    });
    return stockReport.join('\n');
  }

  createBatchAndStockReport(
    stockResponse: InventoryStockResponse[],
    batchResponse: BatchResponse[]
  ) {
    // Implementation for creating inventory report
    const batchAndStockReport = [
      '--- Inventory Stock Report ---',
      this.createStockReport(stockResponse),
      '--- Batch Report ---',
      this.createBatchReport(batchResponse)
    ].join('\n\n');
    return batchAndStockReport;
  }
}
