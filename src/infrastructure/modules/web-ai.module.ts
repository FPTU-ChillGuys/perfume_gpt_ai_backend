import { AIService } from '../servicies/ai.service';
import { Module, Provider } from '@nestjs/common';

export const WEB_CHAT_SERVICE = 'WEB_CHAT_SERVICE';

const webAIProvider: Provider = {
  provide: WEB_CHAT_SERVICE,
  useFactory: () => {
    return new AIService();
  }
};

@Module({
  providers: [webAIProvider],
  exports: [webAIProvider]
})
export class WebAIModule {}
