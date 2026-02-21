import { ProductService } from '../servicies/product.service';
import { Module } from '@nestjs/common';
import { ProductTool } from 'src/chatbot/utils/tools/products.tool';

@Module({
  imports: [],
  providers: [ProductService, ProductTool],
  exports: [ProductService, ProductTool]
})
export class ProductModule {}
