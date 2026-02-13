import { ToolSet, UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandler, funcHandlerAsync } from '../utils/error-handler';
import {
  streamTextGenerationFromMessagesToResultWithErrorHandler,
  streamTextGenerationFromPromptToResultWithErrorHandler,
  textGenerationFromMessagesToResultWithErrorHandler,
  textGenerationFromPromptToResultWithErrorHandler
} from 'src/chatbot/chatbot';
import { gpt5nano } from 'src/chatbot/models/openai';
import { Injectable } from '@nestjs/common';
import { error } from 'console';

@Injectable()
export class AIService {
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
        gpt5nano,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        errorMessage,
        this.stopWhen,
        output
      );
      return { success: true, data: text };
    }, 'Failed to generate text from messages');
  }

  async textGenerateFromMessages(
    messages: UIMessage[],
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const text = await textGenerationFromMessagesToResultWithErrorHandler(
        gpt5nano,
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
    output?: any,
    additionalSystemPrompt?: string,
    errorMessage?: string
  ): BaseResponse<ReadableStream<any>> {
    return funcHandler(() => {
      const stream = streamTextGenerationFromPromptToResultWithErrorHandler(
        gpt5nano,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        this.stopWhen,
        output,
        errorMessage
      );
      return { success: true, data: stream };
    }, 'Failed to generate text stream from messages');
  }

  TextGenerateStreamFromMessages(
    messages: UIMessage[],
    output?: any,
    additionalSystemPrompt?: string,
    errorMessage?: string
  ): BaseResponse<ReadableStream<any>> {
    return funcHandler(() => {
      const stream = streamTextGenerationFromMessagesToResultWithErrorHandler(
        gpt5nano,
        messages,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        this.stopWhen,
        errorMessage,
        output
      );
      return { success: true, data: stream };
    }, 'Failed to generate text stream from messages');
  }
}
