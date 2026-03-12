import { Inject, Injectable } from '@nestjs/common';
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
import { InventoryLogType } from 'src/domain/enum/inventory-log-type.enum';
import { TrendLog } from 'src/domain/entities/trend-log.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Output } from 'ai';
import { AIHelper } from '../helpers/ai.helper';
import { AI_HELPER, AI_RESTOCK_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import {
  inventoryReportPrompt,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_RESTOCK
} from 'src/application/constant/prompts';
import {
  isDataEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from '../utils/insufficient-data';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  AIInventoryReportStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import { restockOutput } from 'src/chatbot/utils/output/restock.output';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_HELPER) private readonly aiHelper: AIHelper,
    @Inject(AI_RESTOCK_HELPER) private readonly aiRestockHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService
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
    report: string,
    type: InventoryLogType = InventoryLogType.REPORT
  ): Promise<BaseResponseAPI<InventoryLog>> {
    return funcHandlerAsync(
      async () => {
        const logEntry = await this.unitOfWork.InventoryLogRepo.insert(
          new InventoryLog({
            inventoryLog: report,
            type: type
          })
        );
        // No need to await or return anything, just fire and forget
        return { success: true, data: logEntry as any };
      },
      'Failed to create inventory log',
      true
    );
  }

  async getAllInventoryLogs(type?: InventoryLogType): Promise<BaseResponse<InventoryLog[]>> {
    return funcHandlerAsync(
      async () => {
        const where = type ? { type } : {};
        const logs = await this.unitOfWork.InventoryLogRepo.find(
          where,
          { orderBy: { updatedAt: 'DESC' } }
        );
        return { success: true, data: logs };
      },
      'Failed to fetch inventory logs',
      true
    );
  }

  async getInventoryLogById(id: string): Promise<BaseResponse<InventoryLog>> {
    return funcHandlerAsync(async () => {
      const log = await this.unitOfWork.InventoryLogRepo.findOne({ id });
      if (!log) {
        return { success: false, error: 'Inventory log not found' };
      }
      return { success: true, data: log };
    }, 'Failed to fetch inventory log');
  }

  /** Lấy N trend log mới nhất (sắp xếp theo thời gian tạo giảm dần) */
  async getLatestTrendLogs(count: number) {
    return funcHandlerAsync(async () => {
      const logs = await this.unitOfWork.TrendLogRepo.find(
        {},
        { orderBy: { createdAt: 'DESC' }, limit: count }
      );
      return { success: true, data: logs };
    }, 'Failed to fetch trend logs');
  }

  /** Lưu kết quả trend AI vào DB (dùng EntityManager qua repository theo MikroORM v6) */
  async saveTrendLog(trendData: string): Promise<void> {
    try {
      const log = new TrendLog({ trendData });
      await this.unitOfWork.TrendLogRepo.getEntityManager().persistAndFlush(log);
    } catch (err) {
      console.error('Failed to save trend log:', err);
    }
  }

  async generateAIInventoryReport(): Promise<BaseResponse<string>> {
    const report = await this.createReportFromBatchAndStock();
    if (isDataEmpty(report?.toString())) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT);
    }
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_INVENTORY);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI inventory report', {
        service: 'AIHelper'
      });
    }
    await this.createInventoryLog(aiResponse.data ?? 'No report generated');
    return Ok(aiResponse.data);
  }

  async generateStructuredAIInventoryReport(): Promise<BaseResponse<AIInventoryReportStructuredResponse>> {
    const startTime = Date.now();
    const report = await this.createReportFromBatchAndStock();
    if (isDataEmpty(report?.toString())) {
      return Ok(new AIInventoryReportStructuredResponse({
        report: INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT,
        generatedAt: new Date(),
        metadata: new AIResponseMetadata({ processingTimeMs: Date.now() - startTime })
      }));
    }
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_INVENTORY);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI inventory report', {
        service: 'AIHelper'
      });
    }
    return Ok(new AIInventoryReportStructuredResponse({
      report: aiResponse.data ?? '',
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs: Date.now() - startTime })
    }));
  }

  async analyzeRestockNeeds(): Promise<BaseResponse<any>> {
    const stockResponse = await this.getInventoryStock(
      new InventoryStockRequest({ PageNumber: 1, PageSize: 1000 })
    );
    const stockItems = stockResponse.payload?.items ?? [];
    if (stockItems.length === 0) {
      return Ok('Không có dữ liệu tồn kho để phân tích.');
    }

    const trendLogsResponse = await this.getLatestTrendLogs(2);
    const trendLogs = trendLogsResponse.data ?? [];
    if (trendLogs.length === 0) {
      return Ok('Không đủ dữ liệu xu hướng để phân tích restock. Vui lòng gọi GET /trends/summary trước.');
    }

    const latestTrend = trendLogs[0]?.trendData ?? '';
    const previousTrend = trendLogs[1]?.trendData ?? '(Không có dữ liệu xu hướng trước đó)';
    const restockPrompt = [
      '[DỮ LIỆU TỒN KHO HIỆN TẠI]',
      JSON.stringify(stockItems, null, 2),
      '',
      '[XU HƯỚNG MỚI NHẤT]',
      latestTrend,
      '',
      '[XU HƯỚNG TRƯỚC ĐÓ]',
      previousTrend
    ].join('\n');

    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_RESTOCK);
    const aiResponse = await this.aiRestockHelper.textGenerateFromPrompt(
      restockPrompt,
      adminPrompt,
      Output.object({ schema: restockOutput.schema })
    );
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI restock analysis', {
        service: 'AIRestockHelper'
      });
    }

    const restockDataStr = typeof aiResponse.data === 'string'
      ? aiResponse.data
      : JSON.stringify(aiResponse.data);
    this.createInventoryLog(restockDataStr, InventoryLogType.RESTOCK)
      .catch(err => console.error('Failed to save restock log:', err));

    return Ok(aiResponse.data);
  }
}

