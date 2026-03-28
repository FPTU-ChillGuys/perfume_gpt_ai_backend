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
  optimizePromptWithIntermediateModel
} from 'src/infrastructure/utils/prompt-optimization.util';
import { ConversationAnalysisService } from '../servicies/conversation-analysis.service';

@Injectable()
export class AIHelper {
  private readonly logger = new Logger(AIHelper.name);

  private resolveModel(): LanguageModel {
    return this.model || aiModel;
  }

  private resolveModelName(model: LanguageModel): string {
    const modelInfo = model as Record<string, unknown>;
    const candidate = modelInfo.modelId ?? modelInfo.model ?? modelInfo.id;
    return typeof candidate === 'string' && candidate.length > 0
      ? candidate
      : 'unknown-model';
  }

  private createRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private logStart(
    requestId: string,
    operation: string,
    modelName: string,
    metadata: string
  ): number {
    const startedAt = Date.now();
    this.logger.log(
      `[AI][START] requestId=${requestId} op=${operation} model=${modelName} ${metadata}`
    );
    return startedAt;
  }

  private logDone(
    requestId: string,
    operation: string,
    modelName: string,
    startedAt: number,
    metadata?: string
  ): void {
    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `[AI][DONE] requestId=${requestId} op=${operation} model=${modelName} durationMs=${durationMs}${metadata ? ` ${metadata}` : ''}`
    );
  }

  private logError(
    requestId: string,
    operation: string,
    modelName: string,
    startedAt: number,
    error: unknown
  ): void {
    const durationMs = Date.now() - startedAt;
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    this.logger.error(
      `[AI][ERROR] requestId=${requestId} op=${operation} model=${modelName} durationMs=${durationMs} message=${errorMessage}`
    );
  }

  constructor(
    private systemPrompt?: string,
    private tools?: ToolSet,
    private stopWhen?: number,
    private temperature?: number,
    private toolChoice?: ToolChoice<ToolSet>,
    private model?: LanguageModel,
    private promptOptimizationConfig?: PromptOptimizationConfig,
    private maxTokens?: number,
    private readonly analysisService?: ConversationAnalysisService
  ) { }

  async textGenerateFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const requestId = this.createRequestId('prompt');
      const model = this.resolveModel();
      const modelName = this.resolveModelName(model);
      const startedAt = this.logStart(
        requestId,
        'textGenerateFromPrompt',
        modelName,
        `promptLength=${prompt.length} tools=${this.tools ? Object.keys(this.tools).length : 0}`
      );

      const systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
      try {
        const optimizedPrompt = await optimizePromptWithIntermediateModel(
          prompt,
          this.promptOptimizationConfig,
          this.logger,
          systemContext
        );

        const text = await textGenerationFromPromptToResultWithErrorHandler(
          model,
          optimizedPrompt,
          this.systemPrompt + (additionalSystemPrompt ?? ''),
          this.tools,
          errorMessage,
          this.stopWhen,
          output,
          this.temperature,
          this.toolChoice,
          this.maxTokens
        );

        this.logDone(
          requestId,
          'textGenerateFromPrompt',
          modelName,
          startedAt,
          `outputLength=${text?.length ?? 0}`
        );

        return { success: true, data: text };
      } catch (error) {
        this.logError(
          requestId,
          'textGenerateFromPrompt',
          modelName,
          startedAt,
          error
        );
        throw error;
      }
    }, 'Failed to generate text from prompt');
  }

  async textGenerateFromMessages(
    messages: UIMessage[],
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const requestId = this.createRequestId('messages');
      const model = this.resolveModel();
      const modelName = this.resolveModelName(model);
      const startedAt = this.logStart(
        requestId,
        'textGenerateFromMessages',
        modelName,
        `messageCount=${messages.length} tools=${this.tools ? Object.keys(this.tools).length : 0}`
      );


      let systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
      try {
        let finalMessages = messages;

        if (this.promptOptimizationConfig?.enablePromptOptimization && this.analysisService) {
          const analysis = await this.analysisService.analyze(messages);
          if (analysis) {
            this.logger.log(`[AIHelper] Structured analysis used. Intent: ${analysis.intent}`);
            systemContext += `\n\n[USER_REQUEST_ANALYSIS]\n${JSON.stringify(analysis, null, 2)}\n`;
          }
        }

        const text = await textGenerationFromMessagesToResultWithErrorHandler(
          model,
          finalMessages,
          systemContext,
          this.tools,
          errorMessage,
          this.stopWhen,
          output,
          this.temperature,
          this.toolChoice,
          this.maxTokens
        );

        this.logDone(
          requestId,
          'textGenerateFromMessages',
          modelName,
          startedAt,
          `outputLength=${text?.length ?? 0}`
        );

        return { success: true, data: text };
      } catch (error) {
        this.logError(
          requestId,
          'textGenerateFromMessages',
          modelName,
          startedAt,
          error
        );
        throw error;
      }
    }, 'Failed to generate text from messages');
  }

  textGenerateStreamFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): BaseResponse<ReadableStream<any>> {
    return funcHandler(() => {
      const requestId = this.createRequestId('stream-prompt');
      const model = this.resolveModel();
      const modelName = this.resolveModelName(model);
      const startedAt = this.logStart(
        requestId,
        'textGenerateStreamFromPrompt',
        modelName,
        `promptLength=${prompt.length} tools=${this.tools ? Object.keys(this.tools).length : 0}`
      );

      const stream = streamTextGenerationFromPromptToResultWithErrorHandler(
        model,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.tools,
        this.stopWhen,
        output,
        errorMessage,
        () => this.logDone(requestId, 'textGenerateStreamFromPrompt', modelName, startedAt),
        this.temperature,
        this.toolChoice,
        this.maxTokens
      );

      this.logger.log(
        `[AI][STREAM] requestId=${requestId} op=textGenerateStreamFromPrompt model=${modelName} status=opened`
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
    const requestId = this.createRequestId('stream-messages');
    const model = this.resolveModel();
    const modelName = this.resolveModelName(model);
    const startedAt = this.logStart(
      requestId,
      'textGenerateStreamFromMessages',
      modelName,
      `messageCount=${messages.length} tools=${this.tools ? Object.keys(this.tools).length : 0}`
    );

    this.logger.log(
      `[AI][STREAM] requestId=${requestId} op=textGenerateStreamFromMessages model=${modelName} status=opened`
    );

    return streamTextGenerationFromMessagesToResultWithErrorHandler(
      model,
      messages,
      this.systemPrompt + (additionalSystemPrompt ?? ''),
      this.tools,
      this.stopWhen,
      errorMessage,
      output,
      () => this.logDone(requestId, 'textGenerateStreamFromMessages', modelName, startedAt),
      this.temperature,
      this.toolChoice,
      this.maxTokens
    );
  }
}
