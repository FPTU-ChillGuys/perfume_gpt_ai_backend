import { Body, Controller, Inject, Post } from '@nestjs/common';
import { UIMessage } from 'ai';
import { AIService } from 'src/infrastructure/servicies/ai.service';

@Controller('ai/mobile')
export class ChatController {
  constructor(@Inject('MOBILE_CHAT_CONTROLLER') aiService: AIService) {}

  @Post('chat')
  async chat(@Body() messages: UIMessage[]) {}
}
