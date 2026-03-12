import { Controller, Get, Inject, Param, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
import { CACHE_TTL_1HOUR } from 'src/infrastructure/cacheable/cacheable.constants';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { InventoryService } from 'src/infrastructure/servicies/inventory.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import {
  AIInventoryReportStructuredResponse
} from 'src/application/dtos/response/ai-structured.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { InventoryLogType } from 'src/domain/enum/inventory-log-type.enum';
import { add } from 'date-fns';

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
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

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
    return this.inventoryService.generateAIInventoryReport();
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
    return this.inventoryService.generateStructuredAIInventoryReport();
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
    return this.inventoryService.analyzeRestockNeeds();
  }
}
