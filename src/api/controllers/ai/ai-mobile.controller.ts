import { Body, Controller, Inject, Post } from '@nestjs/common';
import { UIMessage } from 'ai';

@Controller('ai/mobile')
export class ChatController {
  @Post('chat')
  async chat(@Body() messages: UIMessage[]) {}
}
