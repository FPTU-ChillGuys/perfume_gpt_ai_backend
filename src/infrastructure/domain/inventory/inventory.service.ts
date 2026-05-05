import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { EmailService, EmailTemplate } from 'src/infrastructure/domain/common/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryPrismaRepository } from 'src/infrastructure/domain/repositories/inventory-prisma.repository';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { InventoryLogType } from 'src/domain/enum/inventory-log-type.enum';
import { TrendLog } from 'src/domain/entities/trend-log.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Output } from 'ai';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import {
  AI_HELPER,
  AI_INVENTORY_REPORT_HELPER,
  AI_RESTOCK_HELPER
} from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import {
  inventoryReportPrompt,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_RESTOCK,
  INSTRUCTION_TYPE_SLOW_STOCK
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
import { SourcingCatalogService } from 'src/infrastructure/domain/sourcing/sourcing-catalog.service';
import {
  RestockVariantResult,
  RestockLogPayload
} from 'src/application/dtos/response/inventory/restock-variant.response';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly inventoryPrismaRepo: InventoryPrismaRepository,
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_INVENTORY_REPORT_HELPER) private readonly aiHelper: AIHelper,
    @Inject(AI_RESTOCK_HELPER) private readonly aiRestockHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly sourcingCatalogService: SourcingCatalogService,
    private readonly err: I18nErrorHandler,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

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

    const criticalStocks =
      await this.inventoryPrismaRepo.findStocksByThreshold();

    if (criticalStocks.length === 0) {
      return { variants: currentVariants };
    }

    const existingIds = new Set(currentVariants.map((item) => item.id));
    const merged = this.mergeCriticalStocks(
      currentVariants,
      criticalStocks,
      existingIds
    );
    return { variants: this.sortVariantsByRestockPriority(merged) };
  }

  private mergeCriticalStocks(
    currentVariants: RestockVariantResult[],
    criticalStocks: Awaited<
      ReturnType<InventoryPrismaRepository['findStocksByThreshold']>
    >,
    existingIds: Set<string>
  ): RestockVariantResult[] {
    for (const stock of criticalStocks) {
      if (existingIds.has(stock.VariantId)) {
        continue;
      }
      const status = stock.ProductVariants.Status;
      const isInactive = status === 'Inactive' || status === 'Discontinue';
      const suggestedRestockQuantity = isInactive
        ? 0
        : Math.max(
            stock.LowStockThreshold * 2 - stock.TotalQuantity,
            stock.LowStockThreshold * 2
          );

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
        averageDailySales: 0,
        suggestedRestockQuantity,
        slowStockRisk: null
      });
    }
    return currentVariants;
  }

  private sortVariantsByRestockPriority(
    variants: RestockVariantResult[]
  ): RestockVariantResult[] {
    return variants.sort((left, right) => {
      if (right.suggestedRestockQuantity !== left.suggestedRestockQuantity) {
        return right.suggestedRestockQuantity - left.suggestedRestockQuantity;
      }
      return left.totalQuantity - right.totalQuantity;
    });
  }

  async getInventoryStock(
    request: InventoryStockRequest
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return this.err.wrap(async () => {
      const skip = (request.PageNumber - 1) * request.PageSize;
      const where = this.buildStockWhereClause(request);
      const [stocks, totalCount] = await Promise.all([
        this.inventoryPrismaRepo.findAllStocks(where, skip, request.PageSize),
        this.inventoryPrismaRepo.countStocks(where)
      ]);
      const items = this.mapStocksToResponse(stocks);
      const result = new PagedResult<InventoryStockResponse>({
        items,
        pageNumber: request.PageNumber,
        pageSize: request.PageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / request.PageSize)
      });
      return { success: true, payload: result };
    }, 'errors.inventory.fetch_stock');
  }

  private buildStockWhereClause(
    request: InventoryStockRequest
  ): Prisma.StocksWhereInput {
    return {
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
  }

  private mapStocksToResponse(
    stocks: Awaited<ReturnType<InventoryPrismaRepository['findAllStocks']>>
  ): InventoryStockResponse[] {
    return stocks.map((s) => InventoryStockResponse.fromPrisma(s)!);
  }

  async getBatch(
    request: BatchRequest
  ): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return this.err.wrap(async () => {
      const skip = (request.PageNumber - 1) * request.PageSize;
      const where = this.buildBatchWhereClause(request);
      const [batches, totalCount] = await Promise.all([
        this.inventoryPrismaRepo.findBatches(where, skip, request.PageSize),
        this.inventoryPrismaRepo.countBatches(where)
      ]);
      const items = this.mapBatchesToResponse(batches);
      const result = new PagedResult<BatchResponse>({
        items,
        pageNumber: request.PageNumber,
        pageSize: request.PageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / request.PageSize)
      });
      return { success: true, payload: result };
    }, 'errors.inventory.fetch_batch');
  }

  private buildBatchWhereClause(
    request: BatchRequest
  ): Prisma.BatchesWhereInput {
    return {
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
  }

  private mapBatchesToResponse(
    batches: Awaited<ReturnType<InventoryPrismaRepository['findBatches']>>
  ): BatchResponse[] {
    return batches.map(
      (b) =>
        new BatchResponse({
          id: b.Id,
          batchCode: b.BatchCode,
          importQuantity: b.ImportQuantity,
          remainingQuantity: b.RemainingQuantity,
          manufactureDate: b.ManufactureDate.toISOString(),
          expiryDate: b.ExpiryDate.toISOString(),
          createdAt: b.CreatedAt.toISOString(),
          variantSku: b.ProductVariants.Sku
        })
    );
  }

  async getInventoryOverallStats() {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const [
      totalSku,
      lowStockSku,
      outOfStockSku,
      expiredBatches,
      nearExpiryBatches
    ] = await Promise.all([
      this.inventoryPrismaRepo.countVariants(),
      this.inventoryPrismaRepo.countLowStocks(),
      this.inventoryPrismaRepo.countOutOfStocks(),
      this.inventoryPrismaRepo.countExpiredBatches(now),
      this.inventoryPrismaRepo.countNearExpiryBatches(now, thirtyDaysFromNow)
    ]);

    return {
      totalSku,
      lowStockSku: lowStockSku + outOfStockSku,
      outOfStockSku,
      expiredBatches,
      nearExpiryBatches,
      criticalAlerts: outOfStockSku
    };
  }

  async createReportFromBatchAndStock(): Promise<String> {
    const stats = await this.getInventoryOverallStats();
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const [problematicStocks, standardStocks] = await Promise.all([
      this.inventoryPrismaRepo.findProblematicStocks(thirtyDaysFromNow),
      this.inventoryPrismaRepo.findAllStocksSorted(1000)
    ]);

    const { mergedStocks, existingVariantIds } = this.mergeStocks(
      problematicStocks,
      standardStocks
    );
    const batches = await this.inventoryPrismaRepo.findBatchesByVariantIds(
      Array.from(existingVariantIds)
    );

    return this.buildReportMarkdown(
      stats,
      mergedStocks,
      batches,
      now,
      thirtyDaysFromNow
    );
  }

  private mergeStocks(
    problematicStocks: Awaited<
      ReturnType<InventoryPrismaRepository['findProblematicStocks']>
    >,
    standardStocks: Awaited<
      ReturnType<InventoryPrismaRepository['findAllStocksSorted']>
    >
  ): {
    mergedStocks: typeof problematicStocks;
    existingVariantIds: Set<string>;
  } {
    const mergedStocks = [...problematicStocks];
    const existingVariantIds = new Set(mergedStocks.map((s) => s.VariantId));

    for (const s of standardStocks) {
      if (!existingVariantIds.has(s.VariantId)) {
        mergedStocks.push(s);
        existingVariantIds.add(s.VariantId);
      }
    }
    return { mergedStocks, existingVariantIds };
  }

  private buildReportMarkdown(
    stats: Awaited<ReturnType<InventoryService['getInventoryOverallStats']>>,
    mergedStocks: Awaited<
      ReturnType<InventoryPrismaRepository['findProblematicStocks']>
    >,
    batches: Awaited<
      ReturnType<InventoryPrismaRepository['findBatchesByVariantIds']>
    >,
    now: Date,
    thirtyDaysFromNow: Date
  ): string {
    const batchesByVariantId = new Map<string, typeof batches>();
    batches.forEach((b) => {
      const existing = batchesByVariantId.get(b.VariantId) || [];
      existing.push(b);
      batchesByVariantId.set(b.VariantId, existing);
    });

    const reportLines = [
      '# TỔNG QUAN TRẠNG THÁI KHO (Dữ liệu hệ thống chính xác)',
      `- Tổng số SKU: ${stats.totalSku}`,
      `- Số SKU sắp hết hoặc hết hàng: ${stats.lowStockSku}`,
      `- Số SKU hết hàng hoàn toàn: ${stats.outOfStockSku}`,
      `- Số lô hàng (batch) đã hết hạn: ${stats.expiredBatches}`,
      `- Số lô hàng (batch) cận hạn (dưới 30 ngày): ${stats.nearExpiryBatches}`,
      `- Số cảnh báo nghiêm trọng (hết hàng): ${stats.criticalAlerts}`,
      '',
      '--- CHI TIẾT TỒN KHO VÀ ĐIỀU KIỆN LÔ HÀNG ---',
      'Lưu ý: Danh sách dưới đây liệt kê ưu tiên các mặt hàng đang có vấn đề về tồn kho hoặc hạn dùng.'
    ];

    mergedStocks.forEach((s) => {
      const variantBatches = batchesByVariantId.get(s.VariantId) || [];
      const batchInfo = this.formatBatchInfo(
        variantBatches,
        now,
        thirtyDaysFromNow
      );

      reportLines.push(
        `Sản phẩm: ${s.ProductVariants.Products.Name} (${s.ProductVariants.Concentrations.Name}, ${s.ProductVariants.VolumeMl}ml)`,
        `SKU: ${s.ProductVariants.Sku}`,
        `Tồn kho hiện tại: ${s.TotalQuantity}`,
        `Ngưỡng báo động: ${s.LowStockThreshold}`,
        `Trạng thái: ${s.TotalQuantity === 0 ? 'HẾT HÀNG' : s.TotalQuantity <= s.LowStockThreshold ? 'SẮP HẾT HÀNG' : 'ỔN ĐỊNH'}`,
        `Thông tin lô hàng:`,
        `  ${batchInfo}`,
        '-----------------------------------'
      );
    });

    return reportLines.join('\n');
  }

  private formatBatchInfo(
    batches: Awaited<
      ReturnType<InventoryPrismaRepository['findBatchesByVariantIds']>
    >,
    now: Date,
    nearExpiryDate: Date
  ): string {
    if (batches.length === 0) {
      return '- (Không có dữ liệu lô hàng còn tồn)';
    }
    return batches
      .map((b) => {
        const isExpired = new Date(b.ExpiryDate) < now;
        const isNearExpiry =
          !isExpired && new Date(b.ExpiryDate) < nearExpiryDate;
        let statusLabel = '';
        if (isExpired) statusLabel = ' [HẾT HẠN]';
        else if (isNearExpiry) statusLabel = ' [CẬN HẠN]';

        return `- Lô ${b.BatchCode}: Hạn dùng ${b.ExpiryDate.toISOString().split('T')[0]}, Còn lại ${b.RemainingQuantity}${statusLabel}`;
      })
      .join('\n  ');
  }

  async createInventoryLog(
    report: string,
    type: InventoryLogType = InventoryLogType.REPORT
  ): Promise<BaseResponseAPI<InventoryLog>> {
    return this.err.wrap(async () => {
      const logEntry = await this.unitOfWork.InventoryLogRepo.persistAndReturn(
        new InventoryLog({
          inventoryLog: report,
          type: type
        })
      );
      return { success: true, data: logEntry };
    }, 'errors.inventory.create_log');
  }

  async getAllInventoryLogs(
    type?: InventoryLogType
  ): Promise<BaseResponse<InventoryLog[]>> {
    return this.err.wrap(async () => {
      const where = type ? { type } : {};
      const logs = await this.unitOfWork.InventoryLogRepo.find(where, {
        orderBy: { updatedAt: 'DESC' }
      });
      return { success: true, data: logs };
    }, 'errors.inventory.fetch_logs');
  }

  async getInventoryLogById(id: string): Promise<BaseResponse<InventoryLog>> {
    return this.err.wrap(async () => {
      const log = await this.unitOfWork.InventoryLogRepo.findOne({ id });
      if (!log) {
        return this.err.fail('errors.inventory.not_found');
      }
      return { success: true, data: log };
    }, 'errors.inventory.fetch_log');
  }

  async convertInventoryLogMarkdownToPdf(id: string): Promise<
    BaseResponse<{
      fileName: string;
      absolutePath: string;
      generatedAt: string;
      logType: InventoryLogType;
    }>
  > {
    return this.err.wrap(async () => {
      const log = await this.unitOfWork.InventoryLogRepo.findOne({ id });
      if (!log) {
        return this.err.fail('errors.inventory.not_found');
      }

      const converterRoot = path.join(process.cwd(), 'md-pdf-converter');
      const outputDir = path.join(converterRoot, 'outputs');
      const stylePath = path.join(
        converterRoot,
        'styles',
        'inventory-report.css'
      );
      await fs.promises.mkdir(outputDir, { recursive: true });

      const generatedAt = new Date().toISOString();
      const markdownContent = this.buildPdfMarkdown(log, id, generatedAt);
      const { markdownPath, pdfPath } = this.resolvePdfPaths(outputDir, id);

      await fs.promises.writeFile(markdownPath, markdownContent, 'utf8');
      const hasStyleFile = await fs.promises
        .access(stylePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);

      const { mdToPdf } = await import('md-to-pdf');
      const result = await mdToPdf(
        { path: markdownPath },
        { dest: pdfPath, stylesheet: hasStyleFile ? [stylePath] : [] }
      );

      if (!result || !result.filename) {
        return this.err.fail('errors.inventory.pdf_convert');
      }

      return {
        success: true,
        data: {
          fileName: `inventory-log-${id}.pdf`,
          absolutePath: pdfPath,
          generatedAt,
          logType: log.type
        }
      };
    }, 'errors.inventory.pdf_convert');
  }

  async readInventoryLogPdf(id: string): Promise<{
    fileBuffer: Buffer;
    fileName: string;
  }> {
    const converted = await this.convertInventoryLogMarkdownToPdf(id);
    if (!converted.success) {
      if (converted.error === this.err.t('errors.inventory.not_found')) {
        this.err.throw(
          'errors.inventory.not_found',
          InternalServerErrorWithDetailsException
        );
      }
      this.err.throw(
        'errors.inventory.pdf_convert',
        InternalServerErrorWithDetailsException
      );
    }

    const filePath = converted.data?.absolutePath;
    const fileName = converted.data?.fileName || `inventory-log-${id}.pdf`;

    if (!filePath) {
      this.err.throw(
        'errors.inventory.pdf_empty_path',
        InternalServerErrorWithDetailsException
      );
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    return { fileBuffer, fileName };
  }

  async getInventoryLogsPaged(
    type?: InventoryLogType
  ): Promise<PagedResult<InventoryLog>> {
    const where = type ? { type } : {};
    const logs = await this.unitOfWork.InventoryLogRepo.find(where, {
      orderBy: { updatedAt: 'DESC' }
    });
    return new PagedResult<InventoryLog>({
      items: logs,
      totalCount: logs.length
    });
  }

  private resolvePdfPaths(outputDir: string, id: string) {
    const markdownPath = path.join(outputDir, `inventory-log-${id}.md`);
    const pdfPath = path.join(outputDir, `inventory-log-${id}.pdf`);
    return { markdownPath, pdfPath };
  }

  private buildPdfMarkdown(
    log: InventoryLog,
    id: string,
    generatedAt: string
  ): string {
    const title =
      log.type === InventoryLogType.RESTOCK
        ? 'Báo cáo phân tích nhập hàng'
        : 'Báo cáo tồn kho';
    const reportBody = this.buildMarkdownFromInventoryLog(log);
    return [
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
  }

  private buildMarkdownFromInventoryLog(log: InventoryLog): string {
    const rawContent = (log.inventoryLog || '').trim();
    if (!rawContent) {
      return 'Không có nội dung báo cáo.';
    }

    if (log.type !== InventoryLogType.RESTOCK) {
      return rawContent;
    }

    const parsedPayload = this.tryParseJson(
      rawContent
    ) as RestockLogPayload | null;
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

    return this.buildRestockMarkdownTable(variants);
  }

  private buildRestockMarkdownTable(variants: RestockVariantResult[]): string {
    const tableHeader =
      '| SKU | Tên sản phẩm | Volume | Type | Giá | Tồn kho | Đã đặt | Gợi ý nhập |';
    const tableSeparator = '| --- | --- | --- | --- | --- | --- | --- | --- |';
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

  async getLatestTrendLogs(limit: number) {
    return this.err.wrap(async () => {
      const logs = await this.unitOfWork.TrendLogRepo.getLatestLogs(limit);
      return { success: true, data: logs };
    }, 'errors.inventory.fetch_trend_logs');
  }

  async saveTrendLog(trendData: string): Promise<void> {
    try {
      const log = new TrendLog({ trendData });
      await this.unitOfWork.TrendLogRepo.addAndFlush(log);
    } catch (err) {
      this.err.log('errors.inventory.trend_log_save');
    }
  }

  async generateAIInventoryReport(): Promise<BaseResponse<string>> {
    const report = await this.createReportFromBatchAndStock();
    if (isDataEmpty(report?.toString())) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT);
    }
    const [inventoryPrompt, slowStockPrompt] = await Promise.all([
      this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_INVENTORY
      ),
      this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_SLOW_STOCK
      )
    ]);
    const combinedPrompt = slowStockPrompt
      ? `${inventoryPrompt}\n\n## SLOW STOCK SUPPLEMENT\n${slowStockPrompt}`
      : inventoryPrompt;
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      combinedPrompt
    );
    if (!aiResponse.success) {
      this.err.throw(
        'errors.inventory.ai_report',
        InternalServerErrorWithDetailsException,
        {
          service: 'AIHelper'
        }
      );
    }
    await this.createInventoryLog(aiResponse.data ?? 'No report generated');
    return Ok(aiResponse.data);
  }

  private async enrichVariantWithSourcingInfo(
    variant: RestockVariantResult
  ): Promise<RestockVariantResult> {
    try {
      const sourcingResponse =
        await this.sourcingCatalogService.getCatalogsAsync(variant.id);
      if (sourcingResponse.success && Array.isArray(sourcingResponse.payload)) {
        const primarySourcing = sourcingResponse.payload
          .filter((c) => c.isPrimary)
          .sort(
            (a, b) => Number(a.negotiatedPrice) - Number(b.negotiatedPrice)
          )[0];
        if (primarySourcing) {
          return {
            ...variant,
            supplierId: primarySourcing.supplierId,
            supplierName: primarySourcing.supplierName,
            negotiatedPrice: Number(primarySourcing.negotiatedPrice),
            estimatedLeadTimeDays: primarySourcing.estimatedLeadTimeDays
          };
        }
      }
    } catch (err) {
      this.err.log('errors.inventory.enrich_sourcing');
    }
    return variant;
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
      this.err.throw(
        'errors.inventory.ai_report',
        InternalServerErrorWithDetailsException,
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

  async analyzeRestockNeeds(): Promise<
    BaseResponse<{ variants: RestockVariantResult[] }>
  > {
    const [restockPrompt, slowStockPrompt] = await Promise.all([
      this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_RESTOCK
      ),
      this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_SLOW_STOCK
      )
    ]);
    const combinedPrompt = slowStockPrompt
      ? `${restockPrompt}\n\n## SLOW STOCK SUPPLEMENT\n${slowStockPrompt}`
      : restockPrompt;
    const aiResponse = await this.aiRestockHelper.textGenerateFromPrompt(
      combinedPrompt,
      '',
      Output.object({ schema: restockOutput.schema })
    );
    if (!aiResponse.success) {
      this.err.throw(
        'errors.inventory.ai_restock',
        InternalServerErrorWithDetailsException,
        {
          service: 'AIRestockHelper'
        }
      );
    }

    const normalizedResult = await this.ensureCriticalLowStockIncluded(
      aiResponse.data
    );

    if (normalizedResult.variants && normalizedResult.variants.length > 0) {
      normalizedResult.variants = await Promise.all(
        normalizedResult.variants.map((v) =>
          this.enrichVariantWithSourcingInfo(v)
        )
      );
    }

    const restockDataStr = JSON.stringify(normalizedResult);
    this.createInventoryLog(restockDataStr, InventoryLogType.RESTOCK).catch(
      () => this.err.log('errors.inventory.trend_log_save')
    );

    return Ok(normalizedResult);
  }

  @Cron('0 0 9 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyRestockPrediction(): Promise<void> {
    this.logger.log('[DailyRestockPrediction] Cron job started');
    try {
      await this.sendDailyRestockPredictionReport();
      this.logger.log('[DailyRestockPrediction] Cron job finished');
    } catch (error) {
      this.logger.error('[DailyRestockPrediction] Cron job failed', error);
    }
  }

  private async sendDailyRestockPredictionReport(): Promise<void> {
    const generatedAtDate = new Date();
    const reportDate = generatedAtDate.toISOString().slice(0, 10);
    const generatedAt = generatedAtDate.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh'
    });

    const result = await this.analyzeRestockNeeds();
    if (!result.success || !result.data?.variants || result.data.variants.length === 0) {
      this.logger.log(`[DailyRestockPrediction] Skip sending - no variants suggested on ${reportDate}`);
      return;
    }

    const variants = result.data.variants;

    const staffUsers = await this.prisma.aspNetUsers.findMany({
      where: {
        IsActive: true,
        IsDeleted: false,
        Email: { not: null },
        AspNetUserRoles: {
          some: {
            AspNetRoles: {
              OR: [
                { NormalizedName: 'STAFF' },
                { NormalizedName: 'ADMIN' },
                { Name: { contains: 'staff' } },
                { Name: { contains: 'Staff' } },
                { Name: { contains: 'admin' } },
                { Name: { contains: 'Admin' } }
              ]
            }
          }
        }
      },
      select: { Email: true }
    });

    const recipients = [...new Set(
      staffUsers.map(u => u.Email?.trim().toLowerCase()).filter((e): e is string => e !== undefined && e.length > 0)
    )];

    if (recipients.length === 0) {
      this.logger.warn('[DailyRestockPrediction] No staff/admin recipients found. Report email skipped.');
      return;
    }

    const formatPrice = (price: number | undefined): string =>
      price != null ? price.toLocaleString('vi-VN') + '₫' : '—';

    const formatLeadTime = (days: number | undefined): string =>
      days != null && days > 0 ? `${days} ngày` : '—';

    const supplierGroups = new Map<string, typeof variants>();
    const noSupplierKey = 'Không xác định';

    for (const v of variants) {
      const key = v.supplierName?.trim() || noSupplierKey;
      if (!supplierGroups.has(key)) supplierGroups.set(key, []);
      supplierGroups.get(key)!.push(v);
    }

    const supplierGroupsArray = Array.from(supplierGroups.entries()).map(([supplierName, items]) => ({
      supplierName,
      items: items.map(v => ({
        product: v.productName,
        sku: v.sku,
        suggestedQuantity: v.suggestedRestockQuantity,
        negotiatedPrice: formatPrice(v.negotiatedPrice),
        leadTimeDays: formatLeadTime(v.estimatedLeadTimeDays),
        currentStock: v.totalQuantity
      }))
    }));

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '#';
    const subject = `[AI Restock Prediction] ${variants.length} sản phẩm cần nhập - ${reportDate}`;

    const sendResults = await Promise.allSettled(
      recipients.map(recipient =>
        this.emailService.sendTemplateEmail(
          recipient,
          subject,
          EmailTemplate.RESTOCK_AI_PREDICTION as string,
          {
            userName: 'Staff Team',
            generatedAt,
            totalSuggestions: variants.length,
            supplierGroups: supplierGroupsArray,
            frontendUrl
          }
        )
      )
    );

    const successCount = sendResults.filter(r => r.status === 'fulfilled').length;
    const failCount = sendResults.length - successCount;
    if (failCount > 0) {
      this.logger.warn(`[DailyRestockPrediction] Partial send: ${successCount}/${recipients.length} recipients`);
    } else {
      this.logger.log(`[DailyRestockPrediction] Sent to ${successCount} staff/admin recipient(s), ${variants.length} variants suggested`);
    }
  }
}
