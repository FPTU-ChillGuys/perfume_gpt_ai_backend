import { HttpModule } from '@nestjs/axios';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { Module } from '@nestjs/common';
import { ProductTool } from 'src/chatbot/tools/products.tool';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DictionaryModule } from 'src/infrastructure/domain/common/dictionary.module';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [HttpModule, PrismaModule, DictionaryModule, ProviderModule],
  providers: [ProductService, ProductTool],
  exports: [ProductService, ProductTool]
})
export class ProductModule { }
