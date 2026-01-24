import { Module } from '@nestjs/common';
import { PromptService } from '../servicies/prompt.service';
import { UnitOfWorkModule } from './unit-of-work.module';

@Module({
  imports: [UnitOfWorkModule],
  providers: [PromptService],
  exports: [PromptService]
})
export class PromptModule {}
