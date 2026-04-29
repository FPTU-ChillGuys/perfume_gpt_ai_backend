import {
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  StreamableFile
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { createBackgroundJob, checkBackgroundJobResult } from 'src/api/controllers/helper/background-job.helper';
import { CACHE_TTL_1HOUR } from 'src/infrastructure/domain/common/cacheable/cacheable.constants';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { InventoryService } from 'src/infrastructure/domain/inventory/inventory.service';
import { ApiBaseResponse, ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import {
  AIInventoryReportStructuredResponse
} from 'src/application/dtos/response/ai-structured.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { InventoryLogType } from 'src/domain/enum/inventory-log-type.enum';
import { RestockVariantResult } from 'src/application/dtos/response/inventory/restock-variant.response';
import { VariantSalesAnalyticsResponse } from 'src/application/dtos/response/variant-sales-analytics.response';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';

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
    private readonly restockService: RestockService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  @Get('stock')
  @ApiOperation({ summary: 'Lấy thông tin tồn kho' })
  @ExtendApiBaseResponse(PagedResult, InventoryStockResponse)
  async getInventoryStock(
    @Query() inventoryStockRequest: InventoryStockRequest
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return this.inventoryService.getInventoryStock(inventoryStockRequest);
  }

  @Get('batches')
  @ApiOperation({ summary: 'Lấy danh sách batch' })
  @ExtendApiBaseResponse(PagedResult, BatchResponse)
  async getBatch(
    @Query() batchRequest: BatchRequest
  ): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return this.inventoryService.getBatch(batchRequest);
  }

  @Get('report')
  @ApiOperation({ summary: 'Lấy báo cáo tồn kho' })
  @ApiBaseResponse(String)
  async getInventoryReport(): Promise<BaseResponse<string>> {
    const report = await this.inventoryService.createReportFromBatchAndStock();
    return Ok(report.toString());
  }

  @Get('report/ai')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho bằng AI' })
  @ApiBaseResponse(String)
  async getAIInventoryReport(): Promise<BaseResponse<string>> {
    return this.inventoryService.generateAIInventoryReport();
  }

  @Get('report/ai/structured')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho AI có cấu trúc' })
  @ApiBaseResponse(AIInventoryReportStructuredResponse)
  async getStructuredAIInventoryReport(): Promise<
    BaseResponse<AIInventoryReportStructuredResponse>
  > {
    return this.inventoryService.generateStructuredAIInventoryReport();
  }

  @Public()
  @Get('report/ai/job')
  @ApiOperation({ summary: 'Khởi tạo job để tạo báo cáo tồn kho bằng AI' })
  @ApiQuery({
    name: 'forceRefresh',
    required: false,
    type: Boolean,
    description: 'True để bỏ qua job đang cache và tạo job mới ngay lập tức'
  })
  @ApiBaseResponse(String)
  async createInventoryReportJob(
    @Req() request: Request,
    @Query('forceRefresh') forceRefresh?: boolean | string
  ): Promise<BaseResponse<{ jobId: string }>> {
    const forceRefreshEnabled = forceRefresh === true || String(forceRefresh) === 'true';
    return createBackgroundJob(
      this.cacheManager,
      () => this.getAIInventoryReport(),
      {
        type: 'inventory_report_job',
        cacheKeyFactory: (jobId) => `inventory_report_job_${jobId}`,
        ttlMilliseconds: CACHE_TTL_1HOUR,
        forceRefresh: forceRefreshEnabled,
        cacheByRequest: true
      },
      request
    );
  }

  @Public()
  @Get('report/ai/job/result/:jobId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoàn thành của job báo cáo tồn kho' })
  @ApiBaseResponse(Object)
  @ApiParam({ name: 'jobId', description: 'ID của job' })
  async getInventoryReportJobResult(
    @Param('jobId') jobId: string
  ): Promise<BaseResponse<Record<string, unknown>>> {
    return checkBackgroundJobResult(
      this.cacheManager,
      `inventory_report_job_${jobId}`,
      { jobId, endpoint: 'inventory/report/ai/job/result/:jobId' }
    );
  }

  @Get('report/logs')
  @ApiOperation({ summary: 'Lấy lịch sử báo cáo tồn kho tổng quan' })
  @ExtendApiBaseResponse(PagedResult, String)
  async getInventoryReportLogs(): Promise<
    BaseResponseAPI<PagedResult<InventoryLog>>
  > {
    const result = await this.inventoryService.getInventoryLogsPaged(InventoryLogType.REPORT);
    return Ok(result);
  }

  @Get('restock/logs')
  @ApiOperation({ summary: 'Lấy lịch sử phân tích nhu cầu nhập hàng (restock)' })
  @ExtendApiBaseResponse(PagedResult, String)
  async getInventoryRestockLogs(): Promise<
    BaseResponseAPI<PagedResult<InventoryLog>>
  > {
    const result = await this.inventoryService.getInventoryLogsPaged(InventoryLogType.RESTOCK);
    return Ok(result);
  }

  @Get('report/logs/:id')
  @ApiOperation({ summary: 'Lấy chi tiết báo cáo tồn kho theo ID' })
  @ApiBaseResponse(InventoryLog)
  async getInventoryLogById(
    @Param('id') id: string
  ): Promise<BaseResponse<InventoryLog>> {
    return this.inventoryService.getInventoryLogById(id);
  }

  @Get('report/logs/:id/pdf')
  @ApiOperation({ summary: 'Convert markdown report theo ID sang PDF (không dùng AI)' })
  @ApiParam({ name: 'id', description: 'ID của inventory log cần convert' })
  async convertInventoryLogToPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    try {
      const { fileBuffer, fileName } = await this.inventoryService.readInventoryLogPdf(id);
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return new StreamableFile(fileBuffer);
    } catch (err) {
      if (err instanceof Error && err.message === 'Inventory log not found') {
        throw new NotFoundException(err.message);
      }
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to convert markdown to pdf'
      );
    }
  }

  @Get('restock/logs/:id/pdf')
  @ApiOperation({ summary: 'Convert log restock theo ID sang PDF (không dùng AI)' })
  @ApiParam({ name: 'id', description: 'ID của restock log cần convert' })
  async convertRestockLogToPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    return this.convertInventoryLogToPdf(id, response);
  }

  @Get('restock/ai')
  @ApiOperation({ summary: 'Phân tích nhu cầu nhập hàng dựa trên xu hướng (AI)' })
  @ApiBaseResponse(Object)
  async getAIRestockingNeeds(): Promise<BaseResponse<{ variants: RestockVariantResult[] }>> {
    return this.inventoryService.analyzeRestockNeeds();
  }

  @Public()
  @Get('restock/job')
  @ApiOperation({ summary: 'Khởi tạo job để phân tích nhu cầu nhập hàng (restock)' })
  @ApiQuery({
    name: 'forceRefresh',
    required: false,
    type: Boolean,
    description: 'True để bỏ qua job đang cache và tạo job mới ngay lập tức'
  })
  @ApiBaseResponse(String)
  async createRestockReportJob(
    @Req() request: Request,
    @Query('forceRefresh') forceRefresh?: boolean | string
  ): Promise<BaseResponse<{ jobId: string }>> {
    const forceRefreshEnabled = forceRefresh === true || String(forceRefresh) === 'true';
    return createBackgroundJob(
      this.cacheManager,
      () => this.getAIRestockingNeeds(),
      {
        type: 'inventory_restock_job',
        cacheKeyFactory: (jobId) => `inventory_restock_job_${jobId}`,
        ttlMilliseconds: CACHE_TTL_1HOUR,
        forceRefresh: forceRefreshEnabled,
        cacheByRequest: true
      },
      request
    );
  }

  @Public()
  @Get('restock/job/result/:jobId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoàn thành của job phân tích nhu cầu nhập hàng (restock)' })
  @ApiBaseResponse(Object)
  @ApiParam({ name: 'jobId', description: 'ID của job' })
  async getRestockJobResult(
    @Param('jobId') jobId: string
  ): Promise<BaseResponse<Record<string, unknown>>> {
    return checkBackgroundJobResult(
      this.cacheManager,
      `inventory_restock_job_${jobId}`,
      { jobId, endpoint: 'inventory/restock/job/result/:jobId' }
    );
  }

  @Public()
  @Get('restock/sales-analytics')
  @ApiOperation({
    summary: 'Lấy dữ liệu phân tích bán hàng tất cả variant',
    description: 'Lấy thông tin variant kèm dữ liệu bán hàng theo ngày từ 2 tháng gần nhất, sử dụng cho tool dự đoán tái cấp hàng'
  })
  @ExtendApiBaseResponse(VariantSalesAnalyticsResponse, undefined, true)
  async getProductSalesAnalyticsForRestock(): Promise<BaseResponseAPI<VariantSalesAnalyticsResponse[]>> {
    return this.restockService.getProductSalesAnalyticsForRestock();
  }

  @Public()
  @Get('restock/sales-analytics/:id')
  @ApiOperation({
    summary: 'Lấy dữ liệu phân tích bán hàng một variant',
    description: 'Lấy thông tin variant kèm dữ liệu bán hàng theo ngày từ 2 tháng gần nhất'
  })
  @ApiParam({ name: 'id', description: 'UUID của variant', format: 'uuid' })
  @ExtendApiBaseResponse(VariantSalesAnalyticsResponse)
  async getProductSalesAnalyticsById(
    @Param('id') id: string
  ): Promise<BaseResponseAPI<VariantSalesAnalyticsResponse>> {
    return this.restockService.getVariantSalesAnalyticsById(id);
  }
}