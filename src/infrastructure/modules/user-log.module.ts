import { Module } from '@nestjs/common';
import { UserLogService } from '../servicies/user-log.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { LogTool } from 'src/chatbot/utils/tools/log.tool';

@Module({
  imports: [UnitOfWorkModule],
  providers: [UserLogService, LogTool],
  exports: [UserLogService, LogTool]
})
export class UserLogModule { }

