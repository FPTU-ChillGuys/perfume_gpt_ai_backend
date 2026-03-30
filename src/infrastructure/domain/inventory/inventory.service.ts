import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { InventoryLogType } from 'src/domain/enum/inventory-log-type.enum';
import { TrendLog } from 'src/domain/entities/trend-log.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Output } from 'ai';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_HELPER, AI_INVENTORY_REPORT_HELPER, AI_RESTOCK_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import {
  inventoryReportPrompt,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_RESTOCK
} from 'src/application/constant/prompts';
import {
  isDataEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from 'src/infrastructure/domain/utils/insufficient-data';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  AIInventoryReportStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import { restockOutput } from 'src/chatbot/output/restock.output';

type RestockVariantResult = {
  id: string;
  sku: string;
  productName: string;
  volumeMl: number;
  type: string;
  basePrice: number;
  status: string;
  concentrationName: string | null;
  totalQuantity: number;
  reservedQuantity: number;
  suggestedRestockQuantity: number;
};

type RestockLogPayload = {
  variants?: RestockVariantResult[];
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_INVENTORY_REPORT_HELPER) private readonly aiHelper: AIHelper,
    @Inject(AI_RESTOCK_HELPER) private readonly aiRestockHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService
  ) { }

  private async ensureCriticalLowStockIncluded(
    restockData: unknown
  ): Promise<{ variants: RestockVariantResult[] }> {
    const safeData =
      typeof restockData === 'object' && restockData !== null
        ? (restockData as { variants?: RestockVariantResult[] })
        : {};
    const currentVariants = Array.isArray(safeData.variants)
      ? [...safeData.variants]
      : [];

    const criticalStocks = await this.prisma.stocks.findMany({
      where: {
        ProductVariants: {
          IsDeleted: false,
          Products: { IsDeleted: false }
        },
        TotalQuantity: { lte: this.prisma.stocks.fields.LowStockThreshold }
      },
      include: {
        ProductVariants: {
          include: {
            Products: true,
            Concentrations: true
          }
        }
      }
    });

    if (criticalStocks.length === 0) {
      return { variants: currentVariants };
    }

    const existingIds = new Set(currentVariants.map((item) => item.id));
    for (const stock of criticalStocks) {
      if (existingIds.has(stock.VariantId)) {
        continue;
      }

      const status = stock.ProductVariants.Status;
      const isInactive = status === 'Inactive' || status === 'Discontinue';
      const suggestedRestockQuantity = isInactive
        ? 0
        : Math.max(stock.LowStockThreshold * 2 - stock.TotalQuantity, stock.LowStockThreshold * 2);

      currentVariants.push({
        id: stock.VariantId,
        sku: stock.ProductVariants.Sku,
        productName: stock.ProductVariants.Products.Name,
        volumeMl: stock.ProductVariants.VolumeMl,
        type: stock.ProductVariants.Type,
        basePrice: Number(stock.ProductVariants.BasePrice),
        status,
        concentrationName: stock.ProductVariants.Concentrations.Name,
        totalQuantity: stock.TotalQuantity,
        reservedQuantity: stock.ReservedQuantity,
        suggestedRestockQuantity
      });
    }

    currentVariants.sort((left, right) => {
      if (right.suggestedRestockQuantity !== left.suggestedRestockQuantity) {
        return right.suggestedRestockQuantity - left.suggestedRestockQuantity;
      }
      return left.totalQuantity - right.totalQuantity;
    });

    return { variants: currentVariants };
  }

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

  async getAllInventoryLogs(
    type?: InventoryLogType
  ): Promise<BaseResponse<InventoryLog[]>> {
    return funcHandlerAsync(
      async () => {
        const where = type ? { type } : {};
        const logs = await this.unitOfWork.InventoryLogRepo.find(where, {
          orderBy: { updatedAt: 'DESC' }
        });
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

  async convertInventoryLogMarkdownToPdf(
    id: string
  ): Promise<
    BaseResponse<{
      fileName: string;
      absolutePath: string;
      generatedAt: string;
      logType: InventoryLogType;
    }>
  > {
    return funcHandlerAsync(
      async () => {
        const log = await this.unitOfWork.InventoryLogRepo.findOne({ id });
        if (!log) {
          return { success: false, error: 'Inventory log not found' };
        }

        const converterRoot = path.join(process.cwd(), 'md-pdf-converter');
        const outputDir = path.join(converterRoot, 'outputs');
        const stylePath = path.join(
          converterRoot,
          'styles',
          'inventory-report.css'
        );
        await fs.promises.mkdir(outputDir, { recursive: true });

        const markdownFileName = `inventory-log-${id}.md`;
        const pdfFileName = `inventory-log-${id}.pdf`;
        const markdownPath = path.join(outputDir, markdownFileName);
        const pdfPath = path.join(outputDir, pdfFileName);

        const title =
          log.type === InventoryLogType.RESTOCK
            ? 'Báo cáo phân tích nhập hàng'
            : 'Báo cáo tồn kho';
        const generatedAt = new Date().toISOString();

        const reportBody = this.buildMarkdownFromInventoryLog(log);
        const markdownContent = [
          `# ${title}`,
          '',
          `- Log ID: ${id}`,
          `- Loại log: ${log.type}`,
          `- Thời điểm convert: ${generatedAt}`,
          '',
          '---',
          '',
          reportBody
        ].join('\n');

        await fs.promises.writeFile(markdownPath, markdownContent, 'utf8');

        const { mdToPdf } = await import('md-to-pdf');
        const hasStyleFile = await fs.promises
          .access(stylePath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false);

        const result = await mdToPdf(
          { path: markdownPath },
          {
            dest: pdfPath,
            stylesheet: hasStyleFile ? [stylePath] : []
          }
        );

        if (!result || !result.filename) {
          return {
            success: false,
            error: 'Failed to convert markdown to pdf'
          };
        }

        return {
          success: true,
          data: {
            fileName: pdfFileName,
            absolutePath: pdfPath,
            generatedAt,
            logType: log.type
          }
        };
      },
      'Failed to convert inventory log markdown to pdf'
    );
  }

  private buildMarkdownFromInventoryLog(log: InventoryLog): string {
    const rawContent = (log.inventoryLog || '').trim();
    if (!rawContent) {
      return 'Không có nội dung báo cáo.';
    }

    if (log.type !== InventoryLogType.RESTOCK) {
      return rawContent;
    }

    const parsedPayload = this.tryParseJson(rawContent) as RestockLogPayload | null;
    const variants = Array.isArray(parsedPayload?.variants)
      ? parsedPayload?.variants
      : [];

    if (variants.length === 0) {
      return [
        '## Chi tiết log nhập hàng',
        '',
        'Không có dữ liệu variants hợp lệ trong log RESTOCK.'
      ].join('\n');
    }

    const tableHeader =
      '| SKU | Tên sản phẩm | Volume | Type | Giá | Tồn kho | Đã đặt | Gợi ý nhập |';
    const tableSeparator =
      '| --- | --- | --- | --- | --- | --- | --- | --- |';
    const tableRows = variants.map((variant) => {
      const sku = this.escapeMarkdownCell(variant.sku);
      const productName = this.escapeMarkdownCell(variant.productName);
      const volume = `${Number(variant.volumeMl || 0)}ml`;
      const type = this.escapeMarkdownCell(variant.type || '-');
      const basePrice = this.formatCurrencyVnd(Number(variant.basePrice || 0));
      const stock = Number(variant.totalQuantity || 0);
      const reserved = Number(variant.reservedQuantity || 0);
      const suggested = Number(variant.suggestedRestockQuantity || 0);

      return `| ${sku} | ${productName} | ${volume} | ${type} | ${basePrice} | ${stock} | ${reserved} | ${suggested} |`;
    });

    return [
      '## Chi tiết log nhập hàng',
      '',
      `Tổng số SKU cần xử lý: ${variants.length}`,
      '',
      tableHeader,
      tableSeparator,
      ...tableRows
    ].join('\n');
  }

  private tryParseJson(input: string): unknown | null {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  private escapeMarkdownCell(value: string): string {
    return String(value || '-')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ')
      .trim();
  }

  private formatCurrencyVnd(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))} d`;
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
      await this.unitOfWork.TrendLogRepo.getEntityManager().persistAndFlush(
        log
      );
    } catch (err) {
      console.error('Failed to save trend log:', err);
    }
  }

  async generateAIInventoryReport(): Promise<BaseResponse<string>> {
    const report = await this.createReportFromBatchAndStock();
    if (isDataEmpty(report?.toString())) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT);
    }
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_INVENTORY
      );
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI inventory report',
        {
          service: 'AIHelper'
        }
      );
    }
    await this.createInventoryLog(aiResponse.data ?? 'No report generated');
    return Ok(aiResponse.data);
  }

  async generateStructuredAIInventoryReport(): Promise<
    BaseResponse<AIInventoryReportStructuredResponse>
  > {
    const startTime = Date.now();
    const report = await this.createReportFromBatchAndStock();
    if (isDataEmpty(report?.toString())) {
      return Ok(
        new AIInventoryReportStructuredResponse({
          report: INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT,
          generatedAt: new Date(),
          metadata: new AIResponseMetadata({
            processingTimeMs: Date.now() - startTime
          })
        })
      );
    }
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_INVENTORY
      );
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI inventory report',
        {
          service: 'AIHelper'
        }
      );
    }
    return Ok(
      new AIInventoryReportStructuredResponse({
        report: aiResponse.data ?? '',
        generatedAt: new Date(),
        metadata: new AIResponseMetadata({
          processingTimeMs: Date.now() - startTime
        })
      })
    );
  }

  async analyzeRestockNeeds(): Promise<BaseResponse<any>> {
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_RESTOCK
      );
    const aiResponse = await this.aiRestockHelper.textGenerateFromPrompt(
      adminPrompt, // Empty prompt — all context in adminPrompt
      '',
      Output.object({ schema: restockOutput.schema })
    );
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI restock analysis',
        {
          service: 'AIRestockHelper'
        }
      );
    }

    const normalizedResult = await this.ensureCriticalLowStockIncluded(
      aiResponse.data
    );
    const restockDataStr = JSON.stringify(normalizedResult);
    this.createInventoryLog(restockDataStr, InventoryLogType.RESTOCK).catch(
      (err) => console.error('Failed to save restock log:', err)
    );

    return Ok(normalizedResult);
  }
}
