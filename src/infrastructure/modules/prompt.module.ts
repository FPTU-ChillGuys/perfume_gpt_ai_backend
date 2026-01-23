import { Module } from '@nestjs/common';
import { PromptService } from '../servicies/prompt.service';

@Module({
  providers: [PromptService],
  exports: [PromptService]
})
export class PromptModule {}
