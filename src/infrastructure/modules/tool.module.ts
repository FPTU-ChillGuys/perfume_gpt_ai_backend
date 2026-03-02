import { Module } from '@nestjs/common';
import { Tools } from 'src/chatbot/utils/tools';
import { ProductModule } from './product.module';
import { OrderModule } from './order.module';
import { ProfileModule } from './profile.module';
import { UserLogModule } from './user-log.module';
import { ReviewModule } from './review.module';
import { ReviewTool } from 'src/chatbot/utils/tools/review.tool';

@Module({
  imports: [ProductModule, OrderModule, ProfileModule, UserLogModule, ReviewModule],
  providers: [Tools, ReviewTool],
  exports: [Tools]
})
export class ToolModule { }
