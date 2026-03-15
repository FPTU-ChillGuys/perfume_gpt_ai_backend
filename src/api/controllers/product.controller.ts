import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { ExtendApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { Request } from 'express';
import { getTokenPayloadFromRequest } from 'src/infrastructure/utils/extract-token';
import { v4 as uuidv4 } from 'uuid';
import { SearchRequest } from 'src/application/dtos/request/search.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ProductViewLogRequest, SearchTextLogRequest } from 'src/application/dtos/request/product-log.request';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private productService: ProductService, private userLog: UserLogService) { }

  /** Lấy danh sách tất cả sản phẩm */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả sản phẩm' })
  @ExtendApiBaseResponse(PagedResult<ProductResponse>)
  async getAllProducts(@Query() request: PagedAndSortedRequest): Promise<BaseResponseAPI<PagedResult<ProductResponse>>> {
    return this.productService.getAllProducts(request);
  }

  /** Tìm kiếm sản phẩm bằng semantic search */
  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng semantic search' })
  @ExtendApiBaseResponse(PagedResult<ProductWithVariantsResponse>)
  async getProductsBySemanticSearch(@Req() req: Request, @Query() request: SearchRequest): Promise<BaseResponseAPI<PagedResult<ProductWithVariantsResponse>>> {
    const result = await this.productService.getProductsUsingSemanticSearch(request.searchText, request);
    // Ghi log tìm kiếm của người dùng
    // Lay userId tu token
    const userId = getTokenPayloadFromRequest(req)?.id;
    if (userId) {
      await this.userLog.addSearchLogToUserLog(userId, request.searchText);
    } else {
      // Tu tao moi uuid de luu log cho nguoi dung khong xac dinh
      const anonymousUserId = uuidv4();
      await this.userLog.addSearchLogToUserLog(anonymousUserId, request.searchText);
    }
    return result;
  }

  /** [TEST] Lấy danh sách sản phẩm kèm toàn bộ variants (phân trang) */
  @Public()
  @Get('all/with-variants')
  @ApiOperation({ summary: '[TEST] Lấy danh sách sản phẩm kèm toàn bộ variants' })
  @ExtendApiBaseResponse(PagedResult<ProductWithVariantsResponse>)
  async getAllProductsWithVariants(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    return this.productService.getAllProductsWithVariants(request);
  }

  /** Tìm kiếm sản phẩm bằng semantic search, trả về kèm toàn bộ variants */
  @Public()
  @Get('search/with-variants')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng semantic search, kết quả kèm toàn bộ variants' })
  @ExtendApiBaseResponse(PagedResult<ProductWithVariantsResponse>)
  async getProductsBySemanticSearchWithVariants(
    @Req() req: Request,
    @Query() request: SearchRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    const result = await this.productService.getProductsUsingSemanticSearchWithVariants(
      request.searchText,
      request
    );
    // Ghi log tìm kiếm
    const userId = getTokenPayloadFromRequest(req)?.id;
    const logId = userId ?? uuidv4();
    await this.userLog.addSearchLogToUserLog(logId, request.searchText);
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
    const userId = getTokenPayloadFromRequest(req)?.id ?? uuidv4();
    const viewInfo = await this.productService.resolveProductViewInfo(
      body.productId,
      body.variantId
    );
    const id = await this.userLog.addProductViewLog(
      userId,
      body.productId,
      body.variantId,
      viewInfo.productName,
      viewInfo.variantName
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
    const userId = getTokenPayloadFromRequest(req)?.id ?? uuidv4();
    const id = await this.userLog.addSearchTextLog(userId, body.searchText);
    return { success: true, data: { id } };
  }
}

