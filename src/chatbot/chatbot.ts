import {
  convertToModelMessages,
  createUIMessageStream,
  generateObject,
  generateText,
  LanguageModel,
  Schema,
  stepCountIs,
  streamText,
  ToolChoice,
  ToolSet,
  UIMessage
} from 'ai';

export async function textGenerationFromPromptToResultWithErrorHandler(
  model: LanguageModel,
  prompt: string,
  systemPrompt?: string,
  tools?: ToolSet,
  errorMessage?: string,
  stopWhen?: number,
  output?: any,
  temperature?: number,
  toolChoice?: ToolChoice<ToolSet>,
  maxTokens?: number
) {
  let retries = 2;
  while (retries >= 0) {
    try {
      if (!prompt) {
        console.error(`[chatbot] textGenerationFromPrompt: prompt is empty or undefined`);
        return errorMessage || 'Prompt is required';
      }
      const result = await generateText({
        model: model,
        prompt: prompt,
        system: systemPrompt ? systemPrompt : undefined,
        tools: tools ? tools : undefined,
        toolChoice: toolChoice ? toolChoice : undefined,
        stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
        output: output ? output : undefined,
        temperature: temperature,
        maxOutputTokens: maxTokens
      });
      return result.text;
    } catch (error) {
      console.error(`Error in TextGenerationFromPrompt (Remaining retries: ${retries}):`, error);
      if (retries === 0) {
        if (output) {
          throw error;
        }
        return errorMessage
          ? errorMessage
          : 'Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
      }
      retries--;
    }
  }
}

export async function textGenerationFromMessagesToResultWithErrorHandler(
  model: LanguageModel,
  messages: UIMessage[],
  systemPrompt?: string,
  tools?: ToolSet,
  errorMessage?: string,
  stopWhen?: number,
  output?: any,
  temperature?: number,
  toolChoice?: ToolChoice<ToolSet>,
  maxTokens?: number
) {
  let retries = 2;
  while (retries >= 0) {
    try {
      const modelMessages = await convertToModelMessages(messages);
      const result = await generateText({
        model: model,
        messages: modelMessages,
        system: systemPrompt ? systemPrompt : undefined,
        tools: tools ? tools : undefined,
        toolChoice: toolChoice ? toolChoice : undefined,
        stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
        output: output ? output : undefined,
        temperature: temperature,
        maxOutputTokens: maxTokens
      });
      return result.text;
    } catch (error) {
      console.error(`Error in TextGenerationFromMessages (Remaining retries: ${retries}):`, error);
      if (retries === 0) {
        if (output) {
          throw error;
        }
        return errorMessage
          ? errorMessage
          : 'Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
      }
      retries--;
    }
  }
}

export async function objectGenerationFromMessagesToResultWithErrorHandler<T>(
  model: LanguageModel,
  messages: UIMessage[],
  systemPrompt?: string,
  output?: Schema<T> | { schema: Schema<T> },
  errorMessage?: string,
  temperature?: number,
  maxTokens?: number
): Promise<T | null> {
  let retries = 2;
  while (retries >= 0) {
    try {
      const modelMessages = await convertToModelMessages(messages);
      const result = await generateObject({
        model: model,
        messages: modelMessages,
        system: systemPrompt ? systemPrompt : undefined,
        output: output ? (output as any).schema || output : undefined,
        temperature: temperature,
        maxOutputTokens: maxTokens
      });
      return result.object as T;
    } catch (error) {
      console.error(`Error in ObjectGenerationFromMessages (Remaining retries: ${retries}):`, error);
      if (retries === 0) {
        return null;
      }
      retries--;
    }
  }
  return null;
}

export function streamTextGenerationFromPromptToResultWithErrorHandler(
  model: LanguageModel,
  prompt: string,
  systemPrompt?: string,
  tools?: ToolSet,
  stopWhen?: number,
  output?: any,
  errorMessage?: string,
  onFinish?: (data) => void,
  temperature?: number,
  toolChoice?: ToolChoice<ToolSet>,
  maxTokens?: number
) {
  const stream = createUIMessageStream({
    execute({ writer }) {
      try {
        const result = streamText({
          model: model,
          system: systemPrompt ? systemPrompt : undefined,
          prompt: prompt,
          tools: tools ? tools : undefined,
          toolChoice: toolChoice ? toolChoice : undefined,
          stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
          output: output ? output : undefined,
          temperature: temperature,
          maxOutputTokens: maxTokens
        });
        writer.merge(result.toUIMessageStream());
      } catch {
        writer.write({
          type: 'error',
          errorText: errorMessage
            ? errorMessage
            : 'Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.'
        });
        return;
      }
    },
    onError: () => (errorMessage ? errorMessage : 'An error occurred.'),
    onFinish: (data) => (onFinish ? onFinish(data) : undefined)
  });
  return stream;
}

export function streamTextGenerationFromMessagesToResultWithErrorHandler(
  model: LanguageModel,
  messages: UIMessage[],
  systemPrompt?: string,
  tools?: ToolSet,
  stopWhen?: number,
  output?: any,
  errorMessage?: string,
  onFinish?: (data) => void,
  temperature?: number,
  toolChoice?: ToolChoice<ToolSet>,
  maxTokens?: number
) {
  const stream = createUIMessageStream({
    async execute({ writer }) {
      try {
        const result = streamText({
          model: model,
          system: systemPrompt ? systemPrompt : undefined,
          messages: await convertToModelMessages(messages),
          tools: tools ? tools : undefined,
          toolChoice: toolChoice ? toolChoice : undefined,
          stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
          output: output ? output : undefined,
          temperature: temperature,
          maxOutputTokens: maxTokens
        });
        writer.merge(result.toUIMessageStream());
      } catch {
        writer.write({
          type: 'error',
          errorText: errorMessage
            ? errorMessage
            : 'Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.'
        });
        return;
      }
    },
    onError: () => (errorMessage ? errorMessage : 'An error occurred.'),
    onFinish: (data) => (onFinish ? onFinish(data) : undefined)
  });
  return stream;
}
