import { forwardRef, Module } from '@nestjs/common';
import { UserLogService } from '../servicies/user-log.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { AIModule } from './ai.module';
import { LogTool } from 'src/chatbot/utils/tools/log.tool';

@Module({
  imports: [UnitOfWorkModule, AdminInstructionModule],
  providers: [UserLogService, LogTool],
  exports: [UserLogService, LogTool]
})
export class UserLogModule { }

