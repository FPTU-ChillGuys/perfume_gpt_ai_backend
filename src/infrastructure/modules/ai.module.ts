import { Module, Provider } from '@nestjs/common';
import { AIService } from '../servicies/ai.service';

const MOBILE_CHAT_CONTROLLER = 'MOBILE_CHAT_CONTROLLER';

const mobileAIProvider: Provider = {
  provide: MOBILE_CHAT_CONTROLLER,
  useFactory: () => {
    return new AIService();
  }
};

@Module({
  providers: [mobileAIProvider]
})
export class AIModule {}
