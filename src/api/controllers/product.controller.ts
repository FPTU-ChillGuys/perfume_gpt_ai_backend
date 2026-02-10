import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { ExtendApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private productService: ProductService) {}

  /** Lấy danh sách tất cả sản phẩm */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả sản phẩm' })
  @ExtendApiBaseResponse(PagedResult<ProductResponse>)
  async getAllProducts(@Query() request: PagedAndSortedRequest) {
    return this.productService.getAllProducts(request);
  }

  /** Tìm kiếm sản phẩm bằng semantic search */
  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng semantic search' })
  @ApiQuery({ name: 'searchText', description: 'Từ khóa tìm kiếm' })
  @ExtendApiBaseResponse(PagedResult<ProductResponse>)
  async getProductsBySemanticSearch(@Query('searchText') searchText: string, @Query() request: PagedAndSortedRequest) {
    return this.productService.getProductsUsingSemanticSearch(searchText, request);
  }

}
