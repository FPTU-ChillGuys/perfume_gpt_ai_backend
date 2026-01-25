import { HttpModule } from '@nestjs/axios';
import { ProductService } from '../servicies/product.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [HttpModule],
  providers: [ProductService],
  exports: [ProductService]
})
export class ProductModule {}
