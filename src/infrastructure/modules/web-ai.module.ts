import { AIService } from '../servicies/ai.service';
import { Module, Provider } from '@nestjs/common';

const WEB_CHAT_CONTROLLER = 'WEB_CHAT_CONTROLLER';

const webAIProvider: Provider = {
  provide: WEB_CHAT_CONTROLLER,
  useFactory: () => {
    return new AIService();
  }
};

@Module({
  providers: [webAIProvider],
  exports: [webAIProvider]
})
export class WebAIModule {}
