import { HttpModule } from '@nestjs/axios';
import { ProductService } from '../servicies/product.service';
import { Module } from '@nestjs/common';
import { ProductTool } from 'src/chatbot/utils/tools/products.tool';
import { SearchModule } from './search.module';

@Module({
  imports: [HttpModule, SearchModule],
  providers: [ProductService, ProductTool],
  exports: [ProductService, ProductTool]
})
export class ProductModule { }
