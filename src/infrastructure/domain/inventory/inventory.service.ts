import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
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
import { AI_INVENTORY_REPORT_HELPER, AI_RESTOCK_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import {
  inventoryReportPrompt,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_RESTOCK
} from 'src/application/constant/prompts';
import { I18nService } from 'nestjs-i18n';
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
import { InventoryNatsRepository } from '../repositories/nats/inventory-nats.repository';
import { RedisInventoryStockResponse } from 'src/application/dtos/response/redis-internal.response';

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
  averageDailySales: number;
  suggestedRestockQuantity: number;
  supplierId?: number;
  supplierName?: string;
  negotiatedPrice?: number;
  estimatedLeadTimeDays?: number;
};

type RestockLogPayload = {
  variants?: RestockVariantResult[];
};

type BatchItem = {
  batchCode: string;
  expiryDate: string;
  remainingQuantity: number;
};

@Injectable()
export class InventoryService {
  //Them logger 
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly inventoryNatsRepo: InventoryNatsRepository,
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_INVENTORY_REPORT_HELPER) private readonly aiHelper: AIHelper,
    @Inject(AI_RESTOCK_HELPER) private readonly aiRestockHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly sourcingCatalogService: SourcingCatalogService,
    private readonly i18n: I18nService
  ) { }

  private async ensureCriticalLowStockIncluded(
    restockData: RestockLogPayload | null
  ): Promise<{ variants: RestockVariantResult[] }> {
    const safeData = (restockData && typeof restockData === 'object' ? restockData : {}) as RestockLogPayload;
    const currentVariants = Array.isArray(safeData.variants)
      ? [...safeData.variants]
      : [];

    // Only fetch genuinely critical items — LowStock or OutOfStock
    // Using pageSize: 100 to provide enough candidates while staying safe
    const response = await this.inventoryNatsRepo.getPagedStock({
      isLowStock: true,
      pageSize: 100
    });

    const criticalItems = response?.items || [];
    if (criticalItems.length === 0) {
      return { variants: currentVariants };
    }

    const existingIds = new Set(currentVariants.map((item) => item.id));

    for (const item of criticalItems) {
      if (existingIds.has(item.variantId)) continue;

      // Restore original: Inactive/Discontinued variants should not be restocked
      // We don't have exact status from inventory repo directly, using a safe default rule based on stock.
      const isInactive = item.lowStockThreshold === 0;
      const suggestedRestockQuantity = isInactive
        ? 0
        : Math.max(item.lowStockThreshold * 2 - item.totalQuantity, item.lowStockThreshold * 2);

      currentVariants.push({
        id: item.variantId,
        sku: item.variantSku,
        productName: item.productName,
        volumeMl: item.volumeMl,
        type: 'Standard',
        basePrice: item.basePrice || 0,
        status: 'Active',
        concentrationName: item.concentrationName,
        totalQuantity: item.totalQuantity,
        reservedQuantity: Math.max(0, item.totalQuantity - (item.availableQuantity ?? item.totalQuantity)),
        averageDailySales: 0,
        suggestedRestockQuantity
      });
    }

    return { variants: currentVariants };
  }

  async getInventoryStock(
    request: InventoryStockRequest
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const payload = (await this.inventoryNatsRepo.getPagedStock({
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          searchTerm: request.SearchTerm,
          isLowStock: request.IsLowStock
        })) as PagedResult<InventoryStockResponse>;

        const result = new PagedResult<InventoryStockResponse>({
          items: (payload?.items || []).map(s => new InventoryStockResponse(s)),
          pageNumber: payload?.pageNumber || request.PageNumber,
          pageSize: payload?.pageSize || request.PageSize,
          totalCount: payload?.totalCount || 0,
          totalPages: payload?.totalPages || 0
        });

        return { success: true, payload: result };
      },
      this.i18n.t('inventory.errors.fetchStock'),
      true
    );
  }

  async getBatch(
    request: BatchRequest
  ): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const payload = (await this.inventoryNatsRepo.getPagedBatches({
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          batchCode: request.batchCode,
          isExpired: request.isExpired
        })) as PagedResult<BatchResponse>;

        const result = new PagedResult<BatchResponse>({
          items: (payload?.items || []).map(b => new BatchResponse(b)),
          pageNumber: payload?.pageNumber || request.PageNumber,
          pageSize: payload?.pageSize || request.PageSize,
          totalCount: payload?.totalCount || 0,
          totalPages: payload?.totalPages || 0
        });

        return { success: true, payload: result };
      },
      this.i18n.t('inventory.errors.fetchBatches'),
      true
    );
  }

  /** Tính toán các thông số tổng quan về tồn kho qua Redis Repository */
  async getInventoryOverallStats() {
    const stats = await this.inventoryNatsRepo.getOverallStats();

    return {
      totalSku: stats?.totalSku || 0,
      lowStockSku: stats?.lowStockSku || 0,
      outOfStockSku: stats?.outOfStockSku || 0,
      expiredBatches: stats?.expiredBatches || 0,
      nearExpiryBatches: stats?.nearExpiryBatches || 0,
      criticalAlerts: stats?.criticalAlerts || 0
    };
  }

  async createReportFromBatchAndStock(lang?: string): Promise<String> {
    const stats = await this.getInventoryOverallStats();
    const l = lang || 'vi';

    // 1. Fetch problematic stocks via Redis Repository
    const problematicResponse = await this.inventoryNatsRepo.getPagedStock({
      isLowStock: true,
      pageSize: 200
    });
    const problematicStocks = problematicResponse?.items || [];

    // 2. Fetch standard stocks (top 500, ordered by quantity ascending) via Redis
    const standardResponse = await this.inventoryNatsRepo.getPagedStock({
      pageSize: 500,
      sortBy: 'TotalQuantity',
      sortOrder: 'asc'
    });
    const standardStocks = standardResponse?.items || [];

    // Merge and remove duplicates
    const mergedStocks = [...problematicStocks];
    const existingVariantIds = new Set(mergedStocks.map(s => s.variantId));

    for (const s of standardStocks) {
      if (!existingVariantIds.has(s.variantId)) {
        mergedStocks.push(s);
        existingVariantIds.add(s.variantId);
      }
    }

    const stocks = mergedStocks;
    
    this.logger.log(`[InventoryService] createReportFromBatchAndStock: problematicStocks=${problematicStocks.length}, standardStocks=${standardStocks.length}, mergedStocks=${stocks.length}`);

    // Fetch batches for these variants to provide detailed info
    const batchesByVariantId = new Map<string, BatchItem[]>();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    // Parallel fetch batches with a concurrency control or just sequential for simplicity/safety
    // sequential here to avoid hitting Redis too hard at once
    for (const s of stocks) {
      if (!s.variantId) continue;
      try {
        this.logger.log(`[InventoryService] Fetching batches for variant ${s.variantId}`);
        const bResponse = (await this.inventoryNatsRepo.getPagedBatches({
          variantId: s.variantId,
          pageSize: 20 // Only need latest batches for report
        })) as { items: BatchItem[] };
        if (bResponse?.items) {
          batchesByVariantId.set(s.variantId, bResponse.items);
          this.logger.log(`[InventoryService] Got ${bResponse.items.length} batches for variant ${s.variantId}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch batches for variant ${s.variantId}: ${err.message}`);
      }
    }

    const reportLines = [
      `# ${this.i18n.t('inventory.report.title', { lang: l })}`,
      `- ${this.i18n.t('inventory.report.totalSku', { lang: l })}: ${stats.totalSku}`,
      `- ${this.i18n.t('inventory.report.lowStock', { lang: l })}: ${stats.lowStockSku}`,
      `- ${this.i18n.t('inventory.report.outOfStock', { lang: l })}: ${stats.outOfStockSku}`,
      `- ${this.i18n.t('inventory.report.expired', { lang: l })}: ${stats.expiredBatches}`,
      `- ${this.i18n.t('inventory.report.nearExpiry', { lang: l })}: ${stats.nearExpiryBatches}`,
      `- ${this.i18n.t('inventory.report.criticalAlerts', { lang: l })}: ${stats.criticalAlerts}`,
      '',
      `--- ${this.i18n.t('inventory.report.detailHeader', { lang: l })} ---`,
      this.i18n.t('inventory.report.detailNote', { lang: l })
    ];

    stocks.forEach((s) => {
      const variantBatches = batchesByVariantId.get(s.variantId) || [];
      let batchInfo = `- ${this.i18n.t('inventory.report.noBatchData', { lang: l })}`;

      if (variantBatches.length > 0) {
        batchInfo = variantBatches.map(b => {
          const expiryDate = new Date(b.expiryDate);
          const isExpired = expiryDate < now;
          const isNearExpiry = !isExpired && expiryDate < thirtyDaysFromNow;
          let statusLabel = '';
          if (isExpired) statusLabel = ` [${this.i18n.t('inventory.report.statusLabels.expired', { lang: l })}]`;
          else if (isNearExpiry) statusLabel = ` [${this.i18n.t('inventory.report.statusLabels.nearExpiry', { lang: l })}]`;

          return `- Lô ${b.batchCode}: Hạn dùng ${b.expiryDate.split('T')[0]}, Còn lại ${b.remainingQuantity}${statusLabel}`;
        }).join('\n  ');
      }

      const statusVal = s.totalQuantity === 0 
        ? this.i18n.t('inventory.report.statusLabels.outOfStock', { lang: l })
        : (s.totalQuantity <= s.lowStockThreshold 
            ? this.i18n.t('inventory.report.statusLabels.lowStock', { lang: l })
            : this.i18n.t('inventory.report.statusLabels.stable', { lang: l })
          );

      reportLines.push(
        `${this.i18n.t('inventory.report.product', { lang: l })}: ${s.productName} (${s.concentrationName}, ${s.volumeMl}ml)`,
        `${this.i18n.t('inventory.report.sku', { lang: l })}: ${s.variantSku}`,
        `${this.i18n.t('inventory.report.currentStock', { lang: l })}: ${s.totalQuantity}`,
        `${this.i18n.t('inventory.report.threshold', { lang: l })}: ${s.lowStockThreshold}`,
        `${this.i18n.t('inventory.report.status', { lang: l })}: ${statusVal}`,
        `${this.i18n.t('inventory.report.batchInfo', { lang: l })}:`,
        `  ${batchInfo}`,
        '-----------------------------------'
      );
    });

    return reportLines.join('\n');
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
        return { success: true, data: logEntry };
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
        return { success: false, error: this.i18n.t('inventory.errors.logNotFound') };
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
          return { success: false, error: this.i18n.t('inventory.errors.logNotFound') };
        }
        const l = 'vi'; // Default to Vietnamese for PDFs if not specified

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
            ? this.i18n.t('inventory.report.detailHeader', { lang: l })
            : this.i18n.t('inventory.report.title', { lang: l });
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
            error: this.i18n.t('inventory.errors.pdfConvert')
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

  private tryParseJson<T>(input: string): T | null {
    try {
      return JSON.parse(input) as T;
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

  private async enrichVariantWithSourcingInfo(
    variant: RestockVariantResult
  ): Promise<RestockVariantResult> {
    try {
      const sourcingResponse = await this.sourcingCatalogService.getCatalogsAsync(variant.id);
      if (sourcingResponse.success && Array.isArray(sourcingResponse.payload)) {
        // Find the primary catalog with the lowest negotiated price
        const primarySourcing = sourcingResponse.payload
          .filter(c => c.isPrimary)
          .sort((a, b) => Number(a.negotiatedPrice) - Number(b.negotiatedPrice))[0];
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
      // Silent fail - return original variant if sourcing fetch fails
      console.error(`[InventoryService] Failed to enrich sourcing for variant ${variant.id}:`, err);
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

  async analyzeRestockNeeds(): Promise<BaseResponse<RestockLogPayload>> {
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_RESTOCK
      );
    const aiResponse = await this.aiRestockHelper.textGenerateFromPrompt(
      adminPrompt,
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

    const parsedData = this.tryParseJson(aiResponse.data ?? '') as RestockLogPayload | null;
    const normalizedResult = await this.ensureCriticalLowStockIncluded(
      parsedData
    );

    // Enrich all variants with sourcing info in parallel
    if (normalizedResult.variants && normalizedResult.variants.length > 0) {
      normalizedResult.variants = await Promise.all(
        normalizedResult.variants.map(v => this.enrichVariantWithSourcingInfo(v))
      );
    }

    const restockDataStr = JSON.stringify(normalizedResult);
    this.createInventoryLog(restockDataStr, InventoryLogType.RESTOCK).catch(
      (err) => console.error('Failed to save restock log:', err)
    );

    return Ok(normalizedResult);
  }
}
