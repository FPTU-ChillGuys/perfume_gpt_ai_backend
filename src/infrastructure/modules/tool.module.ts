import { Module } from '@nestjs/common';
import { Tools } from 'src/chatbot/utils/tools';
import { ProductModule } from './product.module';

@Module({
  imports: [ProductModule],
  providers: [Tools],
  exports: [Tools]
})
export class ToolModule {}
