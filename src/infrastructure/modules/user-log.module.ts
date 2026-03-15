import { Module } from '@nestjs/common';
import { UserLogService } from '../servicies/user-log.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { LogTool } from 'src/chatbot/utils/tools/log.tool';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';

@Module({
  imports: [
    UnitOfWorkModule,
    BullModule.registerQueue({ name: QueueName.USER_LOG_SUMMARY_QUEUE })
  ],
  providers: [UserLogService, LogTool],
  exports: [UserLogService, LogTool]
})
export class UserLogModule { }

