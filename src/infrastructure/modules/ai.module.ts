import { SYSTEM_PROMPT } from 'src/chatbot/utils/prompts';
import { AIService } from '../servicies/ai.service';
import { Tools } from 'src/chatbot/utils/tools';
import { Module, Provider } from '@nestjs/common';
import { UnitOfWorkModule } from './unit-of-work.module';
import { ToolModule } from './tool.module';

export const AI_SERVICE = 'AI_SERVICE';

const aiProvider: Provider = {
  provide: AI_SERVICE,
  useFactory: (tools: Tools) => {
    return new AIService(SYSTEM_PROMPT, tools.getTools, 10);
  },
  inject: [Tools]
};

@Module({
  imports: [UnitOfWorkModule, ToolModule],
  providers: [aiProvider],
  exports: [aiProvider]
})
export class AIModule {}
