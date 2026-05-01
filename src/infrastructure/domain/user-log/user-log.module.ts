import { Module } from '@nestjs/common';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { LogTool } from 'src/chatbot/tools/log.tool';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [ProviderModule,
    UnitOfWorkModule,
    BullModule.registerQueue({ name: QueueName.USER_LOG_SUMMARY_QUEUE })
  ],
  providers: [UserLogService, LogTool],
  exports: [UserLogService, LogTool]
})
export class UserLogModule { }

