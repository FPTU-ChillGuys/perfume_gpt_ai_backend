import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { funcHandlerAsync } from '../utils/error-handler';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { UnitOfWork } from '../repositories/unit-of-work';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork
  ) {}

  async getInventoryStock(
    request: InventoryStockRequest
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const where: Prisma.StocksWhereInput = {
          ...(request.VariantId ? { VariantId: request.VariantId } : {}),
          ...(request.SearchTerm
            ? {
                ProductVariants: {
                  Products: { Name: { contains: request.SearchTerm } }
                }
              }
            : {}),
          ...(request.IsLowStock != null
            ? {
                ProductVariants: {
                  Stocks: request.IsLowStock ? { isNot: null } : undefined
                }
              }
            : {})
        };

        const [stocks, totalCount] = await Promise.all([
          this.prisma.stocks.findMany({
            where,
            skip,
            take,
            include: {
              ProductVariants: {
                include: {
                  Products: true,
                  Concentrations: true
                }
              }
            }
          }),
          this.prisma.stocks.count({ where })
        ]);

        const items: InventoryStockResponse[] = stocks.map((s) => {
          const isLowStock = s.TotalQuantity <= s.LowStockThreshold;
          return new InventoryStockResponse({
            id: s.Id,
            variantId: s.VariantId,
            variantSku: s.ProductVariants.Sku,
            productName: s.ProductVariants.Products.Name,
            concentrationName: s.ProductVariants.Concentrations.Name,
            volumeMl: s.ProductVariants.VolumeMl,
            totalQuantity: s.TotalQuantity,
            lowStockThreshold: s.LowStockThreshold,
            isLowStock
          });
        });

        const result = new PagedResult<InventoryStockResponse>({
          items,
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / request.PageSize)
        });
        return { success: true, payload: result };
      },
      'Failed to fetch inventory stock',
      true
    );
  }

  async getBatch(
    request: BatchRequest
  ): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const where: Prisma.BatchesWhereInput = {
          ...(request.id ? { Id: request.id } : {}),
          ...(request.variantId ? { VariantId: request.variantId } : {}),
          ...(request.batchCode
            ? { BatchCode: { contains: request.batchCode } }
            : {}),
          ...(request.manufactureDate
            ? { ManufactureDate: { gte: new Date(request.manufactureDate) } }
            : {}),
          ...(request.expiryDate
            ? { ExpiryDate: { lte: new Date(request.expiryDate) } }
            : {}),
          ...(request.importQuantity
            ? { ImportQuantity: { gte: request.importQuantity } }
            : {}),
          ...(request.remainingQuantity
            ? { RemainingQuantity: { gte: request.remainingQuantity } }
            : {}),
          ...(request.isExpired != null
            ? {
                ExpiryDate: request.isExpired
                  ? { lt: new Date() }
                  : { gte: new Date() }
              }
            : {}),
          ...(request.variantSku ||
          request.productName ||
          request.volumeMl ||
          request.concentrationName
            ? {
                ProductVariants: {
                  ...(request.variantSku
                    ? { Sku: { contains: request.variantSku } }
                    : {}),
                  ...(request.volumeMl ? { VolumeMl: request.volumeMl } : {}),
                  ...(request.productName
                    ? { Products: { Name: { contains: request.productName } } }
                    : {}),
                  ...(request.concentrationName
                    ? {
                        Concentrations: {
                          Name: { contains: request.concentrationName }
                        }
                      }
                    : {})
                }
              }
            : {})
        };

        const [batches, totalCount] = await Promise.all([
          this.prisma.batches.findMany({
            where,
            skip,
            take,
            include: {
              ProductVariants: {
                include: { Products: true, Concentrations: true }
              }
            }
          }),
          this.prisma.batches.count({ where })
        ]);

        const items: BatchResponse[] = batches.map(
          (b) =>
            new BatchResponse({
              id: b.Id,
              batchCode: b.BatchCode,
              importQuantity: b.ImportQuantity,
              remainingQuantity: b.RemainingQuantity,
              manufactureDate: b.ManufactureDate.toISOString(),
              expiryDate: b.ExpiryDate.toISOString(),
              createdAt: b.CreatedAt.toISOString()
            })
        );

        const result = new PagedResult<BatchResponse>({
          items,
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / request.PageSize)
        });
        return { success: true, payload: result };
      },
      'Failed to fetch batches',
      true
    );
  }

  async createReportFromBatchAndStock(): Promise<String> {
    const stockResponse = await this.getInventoryStock(
      new InventoryStockRequest({ PageNumber: 1, PageSize: 1000 })
    );

    const batchResponse = await this.getBatch(
      new BatchRequest({ PageNumber: 1, PageSize: 1000 })
    );

    const report = this.createBatchAndStockReport(
      stockResponse.payload?.items ?? [],
      batchResponse.payload?.items ?? []
    );

    return report;
  }

  createBatchReport(batchResponse: BatchResponse[]): String {
    const batchReport = batchResponse.map((batch) => {
      return `Batch ID: ${batch.id}, Batch Code: ${batch.batchCode}, Import Quantity: ${batch.importQuantity}, Remaining Quantity: ${batch.remainingQuantity}, Manufacture Date: ${batch.manufactureDate}, Expiry Date: ${batch.expiryDate}, Created At: ${batch.createdAt}`;
    });
    return batchReport.join('\n');
  }

  createStockReport(stockResponse: InventoryStockResponse[]): String {
    const stockReport = stockResponse.map((stock) => {
      return `Variant ID: ${stock.variantId}, Variant SKU: ${stock.variantSku}, Product Name: ${stock.productName}, Concentration: ${stock.concentrationName}, Volume: ${stock.volumeMl}ml, Stock Quantity: ${stock.totalQuantity}, Low Stock Threshold: ${stock.lowStockThreshold}, Is Low Stock: ${stock.isLowStock}`;
    });
    return stockReport.join('\n');
  }

  createBatchAndStockReport(
    stockResponse: InventoryStockResponse[],
    batchResponse: BatchResponse[]
  ) {
    const batchAndStockReport = [
      '--- Inventory Stock Report ---',
      this.createStockReport(stockResponse),
      '--- Batch Report ---',
      this.createBatchReport(batchResponse)
    ].join('\n\n');
    return batchAndStockReport;
  }

  async createInventoryLog(
    report: string
  ): Promise<BaseResponseAPI<InventoryLog>> {
    return funcHandlerAsync(
      async () => {
        const logEntry = await this.unitOfWork.InventoryLogRepo.insert(
          new InventoryLog({
            inventoryLog: report
          })
        );
        // No need to await or return anything, just fire and forget
        return { success: true, data: logEntry };
      },
      'Failed to create inventory log',
      true
    );
  }

  async getInventoryLogs(): Promise<BaseResponse<InventoryLog[]>> {
    return funcHandlerAsync(
      async () => {
        const logs = await this.unitOfWork.InventoryLogRepo.findAll();
        return { success: true, data: logs };
      },
      'Failed to fetch inventory logs',
      true
    );
  }
}
