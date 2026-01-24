import { AIService } from '../servicies/ai.service';
import { Module, Provider } from '@nestjs/common';
import { UnitOfWorkModule } from './unit-of-work.module';

export const WEB_CHAT_SERVICE = 'WEB_CHAT_SERVICE';

const webAIProvider: Provider = {
  provide: WEB_CHAT_SERVICE,
  useFactory: () => {
    return new AIService();
  }
};

@Module({
  imports: [UnitOfWorkModule],
  providers: [webAIProvider],
  exports: [webAIProvider]
})
export class WebAIModule {}
