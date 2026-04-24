import { HttpModule } from '@nestjs/axios';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { Module } from '@nestjs/common';
import { ProductTool } from 'src/chatbot/tools/products.tool';
import { DictionaryModule } from 'src/infrastructure/domain/common/dictionary.module';
import { ProductNatsRepository } from '../repositories/nats/product-nats.repository';
import { NatsModule } from '../common/nats/nats.module';

@Module({
  imports: [HttpModule, DictionaryModule, NatsModule],
  providers: [ProductService, ProductTool, ProductNatsRepository],
  exports: [ProductService, ProductTool, ProductNatsRepository]
})
export class ProductModule { }
