import { LanguageModel, ToolChoice, ToolSet, UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandler, funcHandlerAsync } from '../utils/error-handler';
import {
  streamTextGenerationFromMessagesToResultWithErrorHandler,
  streamTextGenerationFromPromptToResultWithErrorHandler,
  textGenerationFromMessagesToResultWithErrorHandler,
  textGenerationFromPromptToResultWithErrorHandler
} from 'src/chatbot/chatbot';
import { Injectable, Logger } from '@nestjs/common';
import { aiModel } from 'src/chatbot/ai-model';
import {
  PromptOptimizationConfig,
  optimizePromptWithIntermediateModel,
  optimizeUserMessageWithIntermediateModel
} from 'src/infrastructure/utils/prompt-optimization.util';

@Injectable()
export class AIHelper {
  private readonly logger = new Logger(AIHelper.name);

  constructor(
    private systemPrompt?: string,
    private tools?: ToolSet,
    private stopWhen?: number,
    private temperature?: number,
    private toolChoice?: ToolChoice<ToolSet>,
    private model?: LanguageModel,
    private promptOptimizationConfig?: PromptOptimizationConfig
  ) {}

  async textGenerateFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
      const optimizedPrompt = await optimizePromptWithIntermediateModel(
        prompt,
        this.promptOptimizationConfig,
        this.logger,
        systemContext
      );

      const text = await textGenerationFromPromptToResultWithErrorHandler(
        this.model || aiModel,
        optimizedPrompt,
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
      const systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
      const optimizedMessages = await optimizeUserMessageWithIntermediateModel(
        messages,
        this.promptOptimizationConfig,
        this.logger,
        systemContext
      );

      const text = await textGenerationFromMessagesToResultWithErrorHandler(
        this.model || aiModel,
        optimizedMessages,
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
