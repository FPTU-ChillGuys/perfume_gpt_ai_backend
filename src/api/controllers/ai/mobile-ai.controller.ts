import { Body, Controller, Inject, Post, Query } from '@nestjs/common';
import { UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { MOBILE_CHAT_SERVICE } from 'src/infrastructure/modules/mobile-ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';

@Controller('ai/mobile')
export class MobileAIController {
  constructor(@Inject(MOBILE_CHAT_SERVICE) private aiService: AIService) {}

  @Public()
  @Post('chat/test')
  async chat(@Body() messages: UIMessage[]) {
    return this.aiService.TextGenerateFromMessages(messages);
  }

  @Public()
  @Post('search/test')
  async searchProductWithAI(
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    return await this.aiService.TextGenerateFromPrompt(prompt);
  }
}
