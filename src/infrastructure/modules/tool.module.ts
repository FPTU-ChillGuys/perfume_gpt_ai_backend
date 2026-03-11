import { Module } from '@nestjs/common';
import { Tools } from 'src/chatbot/utils/tools';
import { ProductModule } from './product.module';
import { OrderModule } from './order.module';
import { ProfileModule } from './profile.module';
import { UserLogModule } from './user-log.module';
import { ReviewModule } from './review.module';
import { UserModule } from './user.module';
import { ReviewTool } from 'src/chatbot/utils/tools/review.tool';
import { UserTool } from 'src/chatbot/utils/tools/user.tool';

@Module({
  imports: [ProductModule, OrderModule, ProfileModule, UserLogModule, ReviewModule, UserModule],
  providers: [Tools, ReviewTool, UserTool],
  exports: [Tools]
})
export class ToolModule { }
