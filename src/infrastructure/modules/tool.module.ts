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
import { InventoryTool } from 'src/chatbot/utils/tools/inventory.tool';
import { UnitOfWorkModule } from './unit-of-work.module';
import { RestockModule } from './restock.module';

@Module({
  imports: [ProductModule, OrderModule, ProfileModule, UserLogModule, ReviewModule, UserModule, UnitOfWorkModule, RestockModule],
  providers: [Tools, ReviewTool, UserTool, InventoryTool],
  exports: [Tools]
})
export class ToolModule { }
