import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { InventoryService } from 'src/infrastructure/servicies/inventory.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';
import { AIInventoryReportStructuredResponse, AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';
import { isDataEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';
import { inventoryReportPrompt, INSTRUCTION_TYPE_INVENTORY } from 'src/application/constant/prompts';

@Public()
@Role('admin')
@ApiTags('Inventory')
@ApiBearerAuth('jwt')
@ApiUnauthorizedResponse({ description: 'Token JWT không hợp lệ hoặc không được cung cấp' })
@ApiForbiddenResponse({ description: 'Yêu cầu role: admin (⚠️ hiện tại @Public() ở class-level khiến AuthGuard skip)' })
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    private readonly adminInstructionService: AdminInstructionService
  ) {}

  /** Lấy thông tin tồn kho */
  @Get('stock')
  @ApiOperation({ summary: 'Lấy thông tin tồn kho' })
  @ApiBaseResponse(PagedResult<InventoryStockResponse>)
  async getInventoryStock(
    @Req() request: Request,
    @Query() inventoryStockRequest: InventoryStockRequest
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return this.inventoryService.getInventoryStock(
      inventoryStockRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** Lấy danh sách batch */
  @Get('batches')
  @ApiOperation({ summary: 'Lấy danh sách batch' })
  @ApiBaseResponse(PagedResult<BatchResponse>)
  async getBatch(@Req() request: Request, @Query() batchRequest: BatchRequest): Promise<BaseResponseAPI<PagedResult<BatchResponse>>> {
    return this.inventoryService.getBatch(
      batchRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** Lấy báo cáo tồn kho */
  @Get('report')

  @ApiOperation({ summary: 'Lấy báo cáo tồn kho' })
  @ApiBaseResponse(String)
  async getInventoryReport(
    @Req() request: Request,
  ): Promise<BaseResponse<string>> {
    const authHeader = extractTokenFromHeader(request!) ?? '';

    // Fetch stock and batch data
    const report =
      await this.inventoryService.createReportFromBatchAndStock(authHeader);

    return { success: true, data: report.toString() };
  }

  /** Tạo báo cáo tồn kho bằng AI */
  @Get('report/ai')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho bằng AI' })
  @ApiBaseResponse(String)
  async getAIInventoryReport(
    @Req() request: Request,
  ): Promise<BaseResponse<string>> {
    const authHeader = extractTokenFromHeader(request!) ?? '';

    // Fetch stock and batch data
    const report =
      await this.inventoryService.createReportFromBatchAndStock(authHeader);

    if (isDataEmpty(report?.toString())) {
      return { success: true, data: INSUFFICIENT_DATA_MESSAGES.INVENTORY_REPORT };
    }

    // Lấy admin instruction cho domain inventory (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_INVENTORY);

    // Generate AI summary
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );

    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI inventory report' };
    }

    return { success: true, data: aiResponse.data };
  }

  /**
   * Tạo báo cáo tồn kho bằng AI - Phiên bản có cấu trúc.
   * Trả về response kèm metadata (thời gian xử lý).
   */
  @Get('report/ai/structured')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho AI có cấu trúc' })
  @ApiBaseResponse(AIInventoryReportStructuredResponse)
  async getStructuredAIInventoryReport(
    @Req() request: Request,
  ): Promise<BaseResponse<AIInventoryReportStructuredResponse>> {
    const startTime = Date.now();
    const authHeader = extractTokenFromHeader(request!) ?? '';

    const report =
      await this.inventoryService.createReportFromBatchAndStock(authHeader);

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
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_INVENTORY);

    const aiResponse = await this.aiService.textGenerateFromPrompt(
      inventoryReportPrompt(report.toString()),
      adminPrompt
    );

    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI inventory report' };
    }

    const processingTimeMs = Date.now() - startTime;

    const structuredResponse = new AIInventoryReportStructuredResponse({
      report: aiResponse.data ?? '',
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    });

    return { success: true, data: structuredResponse };
  }
}
