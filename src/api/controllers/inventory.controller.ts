import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from 'src/application/common/Metadata';
import { BatchRequest } from 'src/application/dtos/request/batch.request';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BatchResponse } from 'src/application/dtos/response/batch.response';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { InventoryService } from 'src/infrastructure/servicies/inventory.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';

@Public()
@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject(AI_SERVICE) private readonly aiService: AIService
  ) {}

  /** Lấy thông tin tồn kho */
  @Get('stock')
  @ApiOperation({ summary: 'Lấy thông tin tồn kho' })
  @ApiBaseResponse(PagedResult<InventoryStockResponse>)
  async getInventoryStock(
    @Req() request: Request,
    @Query() inventoryStockRequest: InventoryStockRequest
  ) {
    return this.inventoryService.getInventoryStock(
      inventoryStockRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** Lấy danh sách batch */
  @Get('batches')
  @ApiOperation({ summary: 'Lấy danh sách batch' })
  @ApiBaseResponse(PagedResult<BatchResponse>)
  async getBatch(@Req() request: Request, @Query() batchRequest: BatchRequest) {
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
  ) {
    const authHeader = extractTokenFromHeader(request!) ?? '';

    // Fetch stock and batch data
    const report =
      await this.inventoryService.createReportFromBatchAndStock(authHeader);

    return { success: true, data: report };
  }

  /** Tạo báo cáo tồn kho bằng AI */
  @Get('report/ai')
  @ApiOperation({ summary: 'Tạo báo cáo tồn kho bằng AI' })
  @ApiBaseResponse(String)
  async getAIInventoryReport(
    @Req() request: Request,
  ) {
    const authHeader = extractTokenFromHeader(request!) ?? '';

    // Fetch stock and batch data
    const report =
      await this.inventoryService.createReportFromBatchAndStock(authHeader);

    // Generate AI summary
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      `Generate a concise inventory report based on the following data:\n\n${report}`
    );

    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI inventory report' };
    }

    return { success: true, data: aiResponse.data };
  }
}
