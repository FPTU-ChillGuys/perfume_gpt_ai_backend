import { Module } from '@nestjs/common';
import { UserService } from 'src/infrastructure/domain/user/user.service';
import { UserTool } from 'src/chatbot/tools/user.tool';
import { PrismaModule } from 'src/prisma/prisma.module';
@Module({
  imports: [PrismaModule],
  providers: [UserService, UserTool],
  exports: [UserService, UserTool]
})
export class UserModule {}
