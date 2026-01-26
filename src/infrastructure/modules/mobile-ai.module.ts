import { Module, Provider } from '@nestjs/common';
import { AIService } from '../servicies/ai.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { Tools } from 'src/chatbot/utils/tools';
import { ToolModule } from './tool.module';

export const MOBILE_CHAT_SERVICE = 'MOBILE_CHAT_SERVICE';

const mobileAIProvider: Provider = {
  provide: MOBILE_CHAT_SERVICE,
  useFactory: (tools: Tools) => {
    return new AIService('', tools.getTools);
  },
  inject: [Tools]
};

@Module({
  imports: [UnitOfWorkModule, ToolModule],
  providers: [mobileAIProvider],
  exports: [mobileAIProvider]
})
export class MobileAIModule {}
