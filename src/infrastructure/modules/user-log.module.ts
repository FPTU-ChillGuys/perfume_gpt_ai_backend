import { Module } from '@nestjs/common';
import { UserLogService } from '../servicies/user-log.service';
import { UnitOfWorkModule } from './unit-of-work.module';

@Module({
  imports: [UnitOfWorkModule],
  providers: [UserLogService],
  exports: [UserLogService]
})
export class UserLogModule {}
