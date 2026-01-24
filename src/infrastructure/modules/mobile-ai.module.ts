import { Module, Provider } from '@nestjs/common';
import { AIService } from '../servicies/ai.service';

export const MOBILE_CHAT_SERVICE = 'MOBILE_CHAT_SERVICE';

const mobileAIProvider: Provider = {
  provide: MOBILE_CHAT_SERVICE,
  useFactory: () => {
    return new AIService();
  }
};

@Module({
  providers: [mobileAIProvider],
  exports: [mobileAIProvider]
})
export class MobileAIModule {}
