import { Controller, Get, Inject, Param, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Output } from 'ai';
import * as crypto from 'crypto';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { processBackgroundJob } from 'src/api/controllers/helper/background-job.helper';
import { CACHE_TTL_1HOUR, CACHE_TTL_6HOUR } from 'src/infrastructure/cacheable/cacheable.constants';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { AI_SERVICE, AI_RESTOCK_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { InventoryService } from 'src/infrastructure/servicies/inventory.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import {
  AIInventoryReportStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import {
  isDataEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from 'src/infrastructure/utils/insufficient-data';
import {
  inventoryReportPrompt,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_RESTOCK
} from 'src/application/constant/prompts';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { InventoryLogType } from 'src/domain/enum/inventory-log-type.enum';
import { add } from 'date-fns';
import { EmailService } from 'src/infrastructure/servicies/mail.service';
import { UserService } from 'src/infrastructure/servicies/user.service';
import { restockOutput } from 'src/chatbot/utils/output/restock.output';

@Role(['admin'])
@ApiTags('Inventory')
@ApiBearerAuth('jwt')
@ApiUnauthorizedResponse({
  description: 'Token JWT không hợp lệ hoặc không được cung cấp'
})
@ApiForbiddenResponse({ description: 'Yêu cầu role: admin' })
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject(AI_RESTOCK_SERVICE) private readonly aiRestockService: AIService,
    private readonly adminInstructionService: AdminInstructionService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) { }

  /** Lấy thông tin tồn kho */
  @Get('stock')
  @ApiOperation({ summary: 'Lấy thông tin tồn kho' })
  @ApiBaseResponse(PagedResult<InventoryStockResponse>)
  async getInventoryStock(
    @Query() inventoryStockRequest: InventoryStockRequest
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return this.inventoryService.getInventoryStock(inventoryStockRequest);
  }

  /** Lấy danh sách batch */
  @Get('batches')
  @ApiOperation({ summary: 'Lấy danh sách batch' })
  @ApiBaseResponse(PagedResult<BatchResponse>)
  async getBatch(
    @Query() batchRequest: BatchRequest
  ): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return this.inventoryService.getBatch(batchRequest);
  }

  /** Lấy báo cáo tồn kho */
  @Get('report')
  @ApiOperation({ summary: 'Lấy báo cáo tồn kho' })
  @ApiBaseResponse(String)
  async getInventoryReport(): Promise<BaseResponse<string>> {
    // Fetch stock and batch data
    const report = await this.inventoryService.createReportFromBatchAndStock();

    return Ok(report.toString());
  }

  /** Tạo báo cáo tồn kho bằng AI */
  @Get('report/ai')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho bằng AI' })
  @ApiBaseResponse(String)
  async getAIInventoryReport(): Promise<BaseResponse<string>> {
    // Fetch stock and batch data
    const report = await this.inventoryService.createReportFromBatchAndStock();

    if (isDataEmpty(report?.toString())) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT);
    }

    // Lấy admin instruction cho domain inventory (nếu có)
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_INVENTORY
      );

    console.log('Generated inventory report, sending to AI service for analysis...');

    // Generate AI summary
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );

    console.log('Received response from AI service for inventory report.');

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI inventory report',
        { service: 'AIService' }
      );
    }

    // Create inventory log
    await this.inventoryService.createInventoryLog(
      aiResponse.data ?? 'No report generated'
    );

    return Ok(aiResponse.data);
  }

  /**
   * Tạo báo cáo tồn kho bằng AI - Phiên bản có cấu trúc.
   * Trả về response kèm metadata (thời gian xử lý).
   */
  @Get('report/ai/structured')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho AI có cấu trúc' })
  @ApiBaseResponse(AIInventoryReportStructuredResponse)
  async getStructuredAIInventoryReport(): Promise<
    BaseResponse<AIInventoryReportStructuredResponse>
  > {
    const startTime = Date.now();

    const report = await this.inventoryService.createReportFromBatchAndStock();

    if (isDataEmpty(report?.toString())) {
      const processingTimeMs = Date.now() - startTime;
      return {
        success: true,
        data: new AIInventoryReportStructuredResponse({
          report: INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT,
          generatedAt: new Date(),
          metadata: new AIResponseMetadata({ processingTimeMs })
        })
      };
    }

    // Lấy admin instruction cho domain inventory (nếu có)
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_INVENTORY
      );

    const aiResponse = await this.aiService.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI inventory report',
        { service: 'AIService' }
      );
    }

    const processingTimeMs = Date.now() - startTime;

    const structuredResponse = new AIInventoryReportStructuredResponse({
      report: aiResponse.data ?? '',
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    });

    return Ok(structuredResponse);
  }

  /**
   * Khởi tạo job để tạo báo cáo tồn kho bằng AI (caching 6 tiếng)
   */
  @Public()
  @Get('report/ai/job')
  @ApiOperation({ summary: 'Khởi tạo job để tạo báo cáo tồn kho bằng AI' })
  @ApiBaseResponse(String)
  @CacheTTL(CACHE_TTL_1HOUR)
  @UseInterceptors(CacheInterceptor)
  async createInventoryReportJob(): Promise<BaseResponse<{ jobId: string }>> {
    const jobId = crypto.randomUUID();
    const cacheKey = `inventory_report_job_${jobId}`;
    const ttlMilliseconds = CACHE_TTL_1HOUR;

    await this.cacheManager.set(cacheKey, { status: 'pending' }, ttlMilliseconds);

    processBackgroundJob(
      this.cacheManager,
      () => this.getAIInventoryReport(),
      { cacheKey, ttlMilliseconds }
    );

    // Goi them thoi gian tiep theo cho den khi het caching
    const expirationTime = add(new Date(), { seconds: ttlMilliseconds / 1000 });

    return Ok({ jobId, expirationTime });
  }

  /**
   * Kiểm tra kết quả job tạo báo cáo tồn kho bằng AI
   */
  @Public()
  @Get('report/ai/job/result/:jobId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoàn thành của job báo cáo tồn kho' })
  @ApiBaseResponse(Object)
  @ApiParam({ name: 'jobId', description: 'ID của job' })
  async getInventoryReportJobResult(
    @Param('jobId') jobId: string
  ): Promise<BaseResponse<any>> {
    const cacheKey = `inventory_report_job_${jobId}`;
    const jobData = await this.cacheManager.get(cacheKey);

    if (!jobData) {
      throw new InternalServerErrorWithDetailsException('Job not found or expired', {
        jobId,
        endpoint: 'inventory/report/ai/job/result/:jobId'
      });
    }

    return Ok(jobData);
  }

  @Get('report/logs')
  @ApiOperation({ summary: 'Lấy lịch sử báo cáo tồn kho tổng quan' })
  @ApiBaseResponse(PagedResult<String>)
  async getInventoryReportLogs(): Promise<
    BaseResponseAPI<PagedResult<String>>
  > {
    const logs = await this.inventoryService.getAllInventoryLogs(InventoryLogType.REPORT);
    return Ok(
      new PagedResult<InventoryLog>({
        items: logs?.data ?? [],
        totalCount: logs?.data?.length ?? 0
      })
    );
  }

  @Get('restock/logs')
  @ApiOperation({ summary: 'Lấy lịch sử phân tích nhu cầu nhập hàng (restock)' })
  @ApiBaseResponse(PagedResult<String>)
  async getInventoryRestockLogs(): Promise<
    BaseResponseAPI<PagedResult<String>>
  > {
    const logs = await this.inventoryService.getAllInventoryLogs(InventoryLogType.RESTOCK);
    return Ok(
      new PagedResult<InventoryLog>({
        items: logs?.data ?? [],
        totalCount: logs?.data?.length ?? 0
      })
    );
  }

  @Get('report/logs/:id')
  @ApiOperation({ summary: 'Lấy chi tiết báo cáo tồn kho theo ID' })
  @ApiBaseResponse(InventoryLog)
  async getInventoryLogById(
    @Query('id') id: string
  ): Promise<BaseResponse<InventoryLog>> {
    return this.inventoryService.getInventoryLogById(id);
  }

  //Tao email cảnh bảo stock

  /** Phân tích nhu cầu nhập hàng (restock) dựa trên xu hướng bán hàng */
  @Get('restock/ai')
  @ApiOperation({ summary: 'Phân tích nhu cầu nhập hàng dựa trên xu hướng (AI)' })
  @ApiBaseResponse(Object)
  async getAIRestockingNeeds(): Promise<BaseResponse<any>> {
    // 1. Lấy dữ liệu tồn kho toàn bộ variant
    const stockResponse = await this.inventoryService.getInventoryStock(
      new InventoryStockRequest({ PageNumber: 1, PageSize: 1000 })
    );
    const stockItems = stockResponse.payload?.items ?? [];

    if (stockItems.length === 0) {
      return Ok('Không có dữ liệu tồn kho để phân tích.');
    }

    // 2. Lấy 2 trend log mới nhất
    const trendLogsResponse = await this.inventoryService.getLatestTrendLogs(2);
    const trendLogs = trendLogsResponse.data ?? [];

    if (trendLogs.length === 0) {
      return Ok('Không đủ dữ liệu xu hướng để phân tích restock. Vui lòng gọi GET /trends/summary trước.');
    }

    const latestTrend = trendLogs[0]?.trendData ?? '';
    const previousTrend = trendLogs[1]?.trendData ?? '(Không có dữ liệu xu hướng trước đó)';

    // 3. Build context prompt
    const stockDataStr = JSON.stringify(stockItems, null, 2);
    const restockPrompt = [
      '[DỮ LIỆU TỒN KHO HIỆN TẠI]',
      stockDataStr,
      '',
      '[XU HƯỚNG MỚI NHẤT]',
      latestTrend,
      '',
      '[XU HƯỚNG TRƯỚC ĐÓ]',
      previousTrend
    ].join('\n');

    // 4. Lấy admin instruction cho domain restock
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(
      INSTRUCTION_TYPE_RESTOCK
    );

    console.log('Sending restock analysis request to AI service...');

    // 5. Gọi AI (dùng AI_RESTOCK_SERVICE — chỉ có trend tools và restockOutput)
    const aiResponse = await this.aiRestockService.textGenerateFromPrompt(
      restockPrompt,
      adminPrompt,
      Output.object({ schema: restockOutput.schema })
    );

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI restock analysis',
        { service: 'AIRestockService' }
      );
    }

    console.log('Received restock analysis from AI service.');

    // Lưu kết quả restock vào DB (fire and forget)
    const restockDataStr = typeof aiResponse.data === 'string'
      ? aiResponse.data
      : JSON.stringify(aiResponse.data);

    this.inventoryService.createInventoryLog(restockDataStr, InventoryLogType.RESTOCK)
      .catch(err => console.error('Failed to save restock log:', err));

    return Ok(aiResponse.data);
  }
}
