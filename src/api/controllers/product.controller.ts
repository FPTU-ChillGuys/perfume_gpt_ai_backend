import { Controller, Get, Query } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { ExtendApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('products')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Public()
  @Get()
  @ExtendApiBaseResponse(PagedResult<ProductResponse>)
  async getAllProducts(@Query() request: PagedAndSortedRequest) {
    return this.productService.getAllProducts(request);
  }

  @Public()
  @Get()
  @ExtendApiBaseResponse(PagedResult<ProductResponse>)
  async getProductsBySemanticSearch(@Query('searchText') searchText: string, @Query() request: PagedAndSortedRequest) {
    return this.productService.getProductsUsingSemanticSearch(searchText,request);
  }
  
}
