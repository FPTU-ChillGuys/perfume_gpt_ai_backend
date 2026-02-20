import { Module } from '@nestjs/common';
import { Tools } from 'src/chatbot/utils/tools';
import { ProductModule } from './product.module';
import { OrderModule } from './order.module';
import { ProfileModule } from './profile.module';

@Module({
  imports: [ProductModule, OrderModule, ProfileModule],
  providers: [Tools],
  exports: [Tools]
})
export class ToolModule {}
