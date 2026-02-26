import { Module } from '@nestjs/common';
import { Tools } from 'src/chatbot/utils/tools';
import { ProductModule } from './product.module';
import { OrderModule } from './order.module';
import { ProfileModule } from './profile.module';
import { UserLogModule } from './user-log.module';

@Module({
  imports: [ProductModule, OrderModule, ProfileModule, UserLogModule],
  providers: [Tools],
  exports: [Tools]
})
export class ToolModule { }
