import { Controller, Get, Query } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { ProductService } from 'src/infrastructure/servicies/product.service';

@Controller('products')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Public()
  @Get()
  async chat(@Query() request: PagedAndSortedRequest) {
    return this.productService.getAllProducts(request);
  }
}
