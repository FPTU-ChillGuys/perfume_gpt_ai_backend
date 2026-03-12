import { ToolSet, UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandler, funcHandlerAsync } from '../utils/error-handler';
import {
  streamTextGenerationFromMessagesToResultWithErrorHandler,
  streamTextGenerationFromPromptToResultWithErrorHandler,
  textGenerationFromMessagesToResultWithErrorHandler,
  textGenerationFromPromptToResultWithErrorHandler
} from 'src/chatbot/chatbot';
import { Injectable } from '@nestjs/common';
import { aiModels } from 'src/chatbot/ai-model';

@Injectable()
export class AIHelper {
  constructor(
    private systemPrompt?: string,
    private tools?: ToolSet,
    private stopWhen?: number
  ) {}

  async textGenerateFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const text = await textGenerationFromPromptToResultWithErrorHandler(
        aiModels,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        errorMessage,
        this.stopWhen,
        output
      );
      return { success: true, data: text };
    }, 'Failed to generate text from prompt');
  }

  async textGenerateFromMessages(
    messages: UIMessage[],
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const text = await textGenerationFromMessagesToResultWithErrorHandler(
        aiModels,
        messages,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        errorMessage,
        this.stopWhen,
        output
      );
      return { success: true, data: text };
    }, 'Failed to generate text from messages');
  }

  textGenerateStreamFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): BaseResponse<ReadableStream<any>> {
    return funcHandler(() => {
      const stream = streamTextGenerationFromPromptToResultWithErrorHandler(
        aiModels,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        this.stopWhen,
        output,
        errorMessage
      );
      return { success: true, data: stream };
    }, 'Failed to generate text stream from prompt');
  }

  textGenerateStreamFromMessages(
    messages: UIMessage[],
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): ReadableStream<any> {
    return streamTextGenerationFromMessagesToResultWithErrorHandler(
      aiModels,
      messages,
      this.systemPrompt + (additionalSystemPrompt ?? ''),
      this.tools,
      this.stopWhen,
      errorMessage,
      output
    );
  }
}
