import { LanguageModel, Schema, ToolChoice, ToolSet, UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { PromptLoaderService } from 'src/infrastructure/domain/utils/prompt-loader.service';
import {
  objectGenerationFromMessagesToResultWithErrorHandler,
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
} from 'src/infrastructure/domain/utils/prompt-optimization.util';

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
    private toolsProvider?: ToolSet | (() => ToolSet),
    private stopWhen?: number,
    private temperature?: number,
    private toolChoice?: ToolChoice<ToolSet>,
    private model?: LanguageModel,
    private promptOptimizationConfig?: PromptOptimizationConfig,
    private maxTokens?: number,
    private readonly err?: I18nErrorHandler,
    private readonly promptLoader?: PromptLoaderService
  ) {}

  private get resolvedTools(): ToolSet | undefined {
    return typeof this.toolsProvider === 'function'
      ? this.toolsProvider()
      : this.toolsProvider;
  }

  async textGenerateFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return (
      (await this.err?.wrap(async () => {
        const requestId = this.createRequestId('prompt');
        const model = this.resolveModel();
        const modelName = this.resolveModelName(model);
        const startedAt = this.logStart(
          requestId,
          'textGenerateFromPrompt',
          modelName,
          `promptLength=${prompt.length} tools=${this.resolvedTools ? Object.keys(this.resolvedTools).length : 0}`
        );

        const systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
        try {
          const optimizedPrompt = await optimizePromptWithIntermediateModel(
            prompt,
            this.promptOptimizationConfig,
            this.logger,
            systemContext,
            this.promptLoader?.get('system.optimization_full')
          );

          const text = await textGenerationFromPromptToResultWithErrorHandler(
            model,
            optimizedPrompt,
            this.systemPrompt + (additionalSystemPrompt ?? ''),
            this.resolvedTools,
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
      }, 'errors.ai_helper.text_from_prompt')) ?? {
        success: false,
        error: 'Failed to generate text from prompt'
      }
    );
  }

  async textGenerateFromMessages(
    messages: UIMessage[],
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): Promise<BaseResponse<string>> {
    return (
      (await this.err?.wrap(async () => {
        const requestId = this.createRequestId('messages');
        const model = this.resolveModel();
        const modelName = this.resolveModelName(model);
        const startedAt = this.logStart(
          requestId,
          'textGenerateFromMessages',
          modelName,
          `messageCount=${messages.length} tools=${this.resolvedTools ? Object.keys(this.resolvedTools).length : 0}`
        );

        let systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
        try {
          let finalMessages = messages;

          const text = await textGenerationFromMessagesToResultWithErrorHandler(
            model,
            finalMessages,
            systemContext,
            this.resolvedTools,
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
      }, 'errors.ai_helper.text_from_messages')) ?? {
        success: false,
        error: 'Failed to generate text from messages'
      }
    );
  }

  textGenerateStreamFromPrompt(
    prompt: string,
    additionalSystemPrompt?: string,
    output?: any,
    errorMessage?: string
  ): BaseResponse<ReadableStream<any>> {
    try {
      const requestId = this.createRequestId('stream-prompt');
      const model = this.resolveModel();
      const modelName = this.resolveModelName(model);
      const startedAt = this.logStart(
        requestId,
        'textGenerateStreamFromPrompt',
        modelName,
        `promptLength=${prompt.length} tools=${this.resolvedTools ? Object.keys(this.resolvedTools).length : 0}`
      );

      const stream = streamTextGenerationFromPromptToResultWithErrorHandler(
        model,
        prompt,
        this.systemPrompt + (additionalSystemPrompt ?? ''),
        this.resolvedTools,
        this.stopWhen,
        output,
        errorMessage,
        () =>
          this.logDone(
            requestId,
            'textGenerateStreamFromPrompt',
            modelName,
            startedAt
          ),
        this.temperature,
        this.toolChoice,
        this.maxTokens
      );

      this.logger.log(
        `[AI][STREAM] requestId=${requestId} op=textGenerateStreamFromPrompt model=${modelName} status=opened`
      );

      return { success: true, data: stream };
    } catch (error) {
      this.logger.error(
        this.err?.t('errors.ai_helper.stream_from_prompt'),
        error
      );
      return {
        success: false,
        error:
          this.err?.t('errors.ai_helper.stream_from_prompt') ??
          'Failed to generate text stream from prompt'
      };
    }
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
      `messageCount=${messages.length} tools=${this.resolvedTools ? Object.keys(this.resolvedTools).length : 0}`
    );

    this.logger.log(
      `[AI][STREAM] requestId=${requestId} op=textGenerateStreamFromMessages model=${modelName} status=opened`
    );

    return streamTextGenerationFromMessagesToResultWithErrorHandler(
      model,
      messages,
      this.systemPrompt + (additionalSystemPrompt ?? ''),
      this.resolvedTools,
      this.stopWhen,
      errorMessage,
      output,
      () =>
        this.logDone(
          requestId,
          'textGenerateStreamFromMessages',
          modelName,
          startedAt
        ),
      this.temperature,
      this.toolChoice,
      this.maxTokens
    );
  }

  async objectGenerateFromMessages<T>(
    messages: UIMessage[],
    output: Schema<T> | { schema: Schema<T> },
    additionalSystemPrompt?: string,
    errorMessage?: string
  ): Promise<BaseResponse<T>> {
    return (
      (await this.err?.wrap(async () => {
        const requestId = this.createRequestId('object-messages');
        const model = this.resolveModel();
        const modelName = this.resolveModelName(model);
        const startedAt = this.logStart(
          requestId,
          'objectGenerateFromMessages',
          modelName,
          `messageCount=${messages.length} hasOutputSchema=${!!output}`
        );

        const systemContext = `${this.systemPrompt ?? ''}\n${additionalSystemPrompt ?? ''}`;
        try {
          const object =
            await objectGenerationFromMessagesToResultWithErrorHandler<T>(
              model,
              messages,
              systemContext,
              output,
              errorMessage,
              this.temperature,
              this.maxTokens
            );

          this.logDone(
            requestId,
            'objectGenerateFromMessages',
            modelName,
            startedAt,
            `success=${!!object}`
          );

          if (!object) {
            return {
              success: false,
              error: errorMessage || 'Failed to generate object'
            };
          }

          return { success: true, data: object };
        } catch (error) {
          this.logError(
            requestId,
            'objectGenerateFromMessages',
            modelName,
            startedAt,
            error
          );
          throw error;
        }
      }, 'errors.ai_helper.object_from_messages')) ?? {
        success: false,
        error: 'Failed to generate object from messages'
      }
    );
  }
}
