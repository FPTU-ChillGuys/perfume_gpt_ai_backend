import { LanguageModel, ToolChoice, ToolSet, UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandler, funcHandlerAsync } from '../utils/error-handler';
import {
  streamTextGenerationFromMessagesToResultWithErrorHandler,
  streamTextGenerationFromPromptToResultWithErrorHandler,
  textGenerationFromMessagesToResultWithErrorHandler,
  textGenerationFromPromptToResultWithErrorHandler
} from 'src/chatbot/chatbot';
import { Injectable } from '@nestjs/common';
import { aiModel } from 'src/chatbot/ai-model';

@Injectable()
export class AIHelper {
  constructor(
    private systemPrompt?: string,
    private tools?: ToolSet,
    private stopWhen?: number,
    private temperature?: number,
    private toolChoice?: ToolChoice<ToolSet>,
    private model? : LanguageModel
  ) {}

  async textGenerateFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const text = await textGenerationFromPromptToResultWithErrorHandler(
        this.model || aiModel,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        errorMessage,
        this.stopWhen,
        output,
        this.temperature,
        this.toolChoice
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
        this.model || aiModel,
        messages,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        errorMessage,
        this.stopWhen,
        output,
        this.temperature,
        this.toolChoice
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
        this.model || aiModel,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        this.stopWhen,
        output,
        errorMessage,
        undefined,
        this.temperature,
        this.toolChoice
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
      this.model || aiModel,
      messages,
      this.systemPrompt + (additionalSystemPrompt ?? ''),
      this.tools,
      this.stopWhen,
      errorMessage,
      output,
      undefined,
      this.temperature,
      this.toolChoice
    );
  }
}
