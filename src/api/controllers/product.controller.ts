import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseUUIDPipe, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { BestSellingProductResponse } from 'src/application/dtos/response/product-insight.response';
import { VariantSalesAnalyticsResponse } from 'src/application/dtos/response/variant-sales-analytics.response';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { HybridSearchService } from 'src/infrastructure/domain/hybrid-search/hybrid-search.service';
import { HybridSearchResponse } from 'src/infrastructure/domain/hybrid-search/hybrid-search.service';
import { Request } from 'express';
import { resolveLogUserIdFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { SearchRequest } from 'src/application/dtos/request/search.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ProductViewLogRequest, SearchTextLogRequest } from 'src/application/dtos/request/product-log.request';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);
  constructor(
    private productService: ProductService,
    private userLog: UserLogService,
    private aiAnalysisService: AiAnalysisService,
    private hybridSearchService: HybridSearchService
  ) { }

  /** Hybrid Search v4 - Query Layer + Vector Layer */
  @Public()
  @Get('search/v4')
  @ApiOperation({ summary: 'Hybrid Search v4 - Kết hợp Query Layer (hard filters) và Vector Layer (similarity)' })
  @ExtendApiBaseResponse(HybridSearchResponse)
  async getProductsByHybridSearch(
    @Req() req: Request,
    @Query() request: SearchRequest
  ): Promise<BaseResponseAPI<HybridSearchResponse>> {
    const result = await this.hybridSearchService.search(request.searchText, request);

    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, request.searchText);

    return result;
  }

  /** [TEST] Lấy chi tiết một sản phẩm kèm toàn bộ variants */
  @Public()
  @Get(':id/with-variants')
  @ApiOperation({ summary: '[TEST] Lấy chi tiết sản phẩm kèm toàn bộ variants' })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm', format: 'uuid' })
  @ExtendApiBaseResponse(ProductWithVariantsResponse)
  async getProductWithVariants(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ): Promise<BaseResponse<ProductWithVariantsResponse>> {
    return this.productService.getProductWithVariants(id);
  }

  /** Ghi log khi người dùng click vào một sản phẩm hoặc variant */
  @Public()
  @Post('log/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi log khi người dùng xem / click vào product hoặc variant' })
  async logProductView(
    @Req() req: Request,
    @Body() body: ProductViewLogRequest
  ): Promise<BaseResponse<{ id: string }>> {
    const rawUserId = body.userId || resolveLogUserIdFromRequest(req);
    const userId = rawUserId.toLowerCase();

    if (userId.startsWith('anonymous:')) {
      this.logger.warn(
        `[PRODUCT-LOG] logProductView is using anonymous userId. Pass body.userId or Bearer token for personalized recommendation.`
      );
    }
    this.logger.log(
      `[PRODUCT-LOG] logProductView userId=${userId}, productId=${body.productId}, variantId=${body.variantId || 'n/a'}`
    );

    const viewInfo = await this.productService.resolveProductViewInfo(
      body.productId,
      body.variantId
    );
    const id = await this.userLog.addProductViewLog(
      userId,
      body.productId,
      body.variantId,
      viewInfo.productName,
      viewInfo.variantName,
      {
        brand: viewInfo.brand,
        category: viewInfo.category,
        gender: viewInfo.gender,
        scentNotes: viewInfo.scentNotes,
        olfactoryFamilies: viewInfo.olfactoryFamilies,
        basePrice: viewInfo.basePrice
      }
    );
    return { success: true, data: { id } };
  }

  /** Ghi log từ khóa tìm kiếm (chỉ log, không thực hiện tìm kiếm) */
  @Public()
  @Post('log/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi log từ khóa tìm kiếm (không thực hiện tìm kiếm)' })
  async logSearchText(
    @Req() req: Request,
    @Body() body: SearchTextLogRequest
  ): Promise<BaseResponse<{ id: string }>> {
    const rawUserId = body.userId || resolveLogUserIdFromRequest(req);
    const userId = rawUserId.toLowerCase();

    if (userId.startsWith('anonymous:')) {
      this.logger.warn(
        `[PRODUCT-LOG] logSearchText is using anonymous userId. Pass body.userId or Bearer token for personalized recommendation.`
      );
    }
    this.logger.log(
      `[PRODUCT-LOG] logSearchText userId=${userId}, searchText=${body.searchText}`
    );

    const id = await this.userLog.addSearchTextLog(userId, body.searchText);
    return { success: true, data: { id } };
  }

}
