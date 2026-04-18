import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SourcingCatalogService } from 'src/infrastructure/domain/sourcing/sourcing-catalog.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { CatalogItemResponse } from 'src/application/dtos/response/catalog-item.response';

@ApiTags('Sourcing')
@Controller('sourcing')
export class SourcingController {
  constructor(private readonly sourcingCatalogService: SourcingCatalogService) {}

  @Get('catalogs/:variantId')
  @ApiOperation({
    summary: 'Test get catalogs for a specific variant via Redis Pub/Sub',
    description: 'Sends a catalog_request to the main backend and awaits a response.',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    type: BaseResponseAPI,
  })
  async getCatalogs(
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ): Promise<BaseResponseAPI<CatalogItemResponse[]>> {
    return await this.sourcingCatalogService.getCatalogsAsync(variantId);
  }
}
