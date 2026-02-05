import { Controller, Get, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { Public } from "src/application/common/Metadata";
import { InventoryStockRequest } from "src/application/dtos/request/inventory-stock.request";
import { PagedResult } from "src/application/dtos/response/common/paged-result";
import { InventoryStockResponse } from "src/application/dtos/response/inventory-stock.response";
import { InventoryService } from "src/infrastructure/servicies/inventory.service";
import { ApiBaseResponse } from "src/infrastructure/utils/api-response-decorator";
import { extractTokenFromHeader } from "src/infrastructure/utils/extract-token";

@Public()
@Controller('inventory')
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) {}

    @Get('stock')
    @ApiBaseResponse(PagedResult<InventoryStockResponse>)
    async getInventoryStock(@Req() request: Request, @Query() inventoryStockRequest: InventoryStockRequest) {
        return this.inventoryService.getInventoryStock(inventoryStockRequest, extractTokenFromHeader(request!) ?? '');
    }

}