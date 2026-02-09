import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
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
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject(AI_SERVICE) private readonly aiService: AIService
  ) {}

  /** 
   * Lay stock hang ton kho
   * Chú ý, request dùng để lấy token xác thực người dùng và có thể bỏ để tránh lỗi và chuyển sang dùng qua axios interceptor
   */
  @Get('stock')
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

  /** 
   * Lay batch
   * Chú ý, request dùng để lấy token xác thực người dùng và có thể bỏ để tránh lỗi và chuyển sang dùng qua axios interceptor
   */
  @Get('batches')
  @ApiBaseResponse(PagedResult<BatchResponse>)
  async getBatch(@Req() request: Request, @Query() batchRequest: BatchRequest) {
    return this.inventoryService.getBatch(
      batchRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** 
   * Lay stock hang ton kho
   * Chú ý, request dùng để lấy token xác thực người dùng và có thể bỏ để tránh lỗi và chuyển sang dùng qua axios interceptor
   */
  @Get('report')
  @ApiBaseResponse(String)
  //Get AI generated inventory report
  async getInventoryReport(
    @Req() request: Request,
  ) {
    const authHeader = extractTokenFromHeader(request!) ?? '';

    // Fetch stock and batch data
    const report =
      await this.inventoryService.createReportFromBatchAndStock(authHeader);

    return { success: true, data: report };
  }

  /** 
   * Lay stock hang ton kho
   * Chú ý, request dùng để lấy token xác thực người dùng và có thể bỏ để tránh lỗi và chuyển sang dùng qua axios interceptor
   */
  @Get('report/ai')
  @ApiBaseResponse(String)
  //Get AI generated inventory report
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
