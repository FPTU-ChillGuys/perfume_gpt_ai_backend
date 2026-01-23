import { ToolSet, UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandler, funcHandlerAsync } from '../utils/error-handler';
import {
  StreamTextGenerationFromMessagesToResultWithErrorHandler,
  TextGenerationFromMessagesToResultWithErrorHandler
} from 'src/chatbot/chatbot';
import { gpt5nano } from 'src/chatbot/models/openai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AIService {
  constructor(
    private systemPrompt?: string,
    private tools?: ToolSet,
    private stopWhen?: number
  ) {}

  async TextGenerateFromMessages(
    messages: UIMessage[]
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const text = await TextGenerationFromMessagesToResultWithErrorHandler(
        gpt5nano,
        messages,
        this.systemPrompt,
        this.tools
      );
      return { success: true, data: text };
    }, 'Failed to generate text from messages');
  }

  TextGenerateStreamFromMessages(
    messages: UIMessage[]
  ): BaseResponse<ReadableStream<any>> {
    return funcHandler(() => {
      const stream = StreamTextGenerationFromMessagesToResultWithErrorHandler(
        gpt5nano,
        messages,
        this.systemPrompt,
        this.tools,
        this.stopWhen
      );
      return { success: true, data: stream };
    }, 'Failed to generate text stream from messages');
  }
}
