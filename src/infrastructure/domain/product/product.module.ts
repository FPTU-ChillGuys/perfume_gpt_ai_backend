import { HttpModule } from '@nestjs/axios';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { Module } from '@nestjs/common';
import { ProductTool } from 'src/chatbot/tools/products.tool';
import { SearchModule } from 'src/infrastructure/domain/search/search.module';
import { PrismaModule } from 'src/prisma/prisma.module';


@Module({
  imports: [HttpModule, SearchModule, PrismaModule],
  providers: [ProductService, ProductTool],
  exports: [ProductService, ProductTool]
})
export class ProductModule { }
