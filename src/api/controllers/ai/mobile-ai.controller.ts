import { Body, Controller, Inject, Post } from '@nestjs/common';
import { UIMessage } from 'ai';
import { MOBILE_CHAT_SERVICE } from 'src/infrastructure/modules/mobile-ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';

@Controller('ai/mobile')
export class MobileAIController {
  constructor(@Inject(MOBILE_CHAT_SERVICE) private aiService: AIService) {}

  @Post('chat/test')
  async chat(@Body() messages: UIMessage[]) {
    return this.aiService.TextGenerateFromMessages(messages);
  }
}
