import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { ExtendApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { Request } from 'express';
import { getTokenPayloadFromRequest } from 'src/infrastructure/utils/extract-token';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private productService: ProductService, private userLog: UserLogService) {}

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
  @ApiQuery({ name: 'searchText', description: 'Từ khóa tìm kiếm' })
  @ExtendApiBaseResponse(PagedResult<ProductResponse>)
  async getProductsBySemanticSearch(@Req() req : Request, @Query('searchText') searchText: string, @Query() request: PagedAndSortedRequest): Promise<BaseResponseAPI<PagedResult<ProductResponse>>> {
    const result = await this.productService.getProductsUsingSemanticSearch(searchText, request);
    // Ghi log tìm kiếm của người dùng
    // Lay userId tu token
    const userId = getTokenPayloadFromRequest(req)?.id;
    if (userId) {
      await this.userLog.addSearchLogToUserLog(userId, searchText);
    } else {
      // Tu tao moi uuid de luu log cho nguoi dung khong xac dinh
      const anonymousUserId = uuidv4();
      await this.userLog.addSearchLogToUserLog(anonymousUserId, searchText);
    }
    await this.userLog.addSearchLogToUserLog(searchText, 'product');
    return result;
  }

}
