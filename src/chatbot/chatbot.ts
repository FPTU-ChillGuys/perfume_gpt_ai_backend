import {
  convertToModelMessages,
  createUIMessageStream,
  generateText,
  LanguageModel,
  stepCountIs,
  streamText,
  ToolSet,
  UIMessage
} from 'ai';

export async function textGenerationFromPromptToResultWithErrorHandler(
  model: LanguageModel,
  prompt: string,
  systemPrompt?: string,
  tools?: ToolSet,
  errorMessage?: string,
  stopWhen?: number
) {
  try {
    const result = await generateText({
      model: model,
      prompt: prompt,
      system: systemPrompt ? systemPrompt : undefined,
      tools: tools ? tools : undefined,
      stopWhen: stepCountIs(stopWhen ? stopWhen : 5)
    });
    return result.text;
  } catch (error) {
    console.error('Error in TextGenerationFromMessages:', error);
    return errorMessage
      ? errorMessage
      : 'Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
  }
}

export async function textGenerationFromMessagesToResultWithErrorHandler(
  model: LanguageModel,
  messages: UIMessage[],
  systemPrompt?: string,
  tools?: ToolSet,
  errorMessage?: string,
  stopWhen?: number,
  output?: any
) {
  try {
    const modelMessages = await convertToModelMessages(messages);
    const result = await generateText({
      model: model,
      messages: modelMessages,
      system: systemPrompt ? systemPrompt : undefined,
      tools: tools ? tools : undefined,
      stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
      output: output ? output : undefined
    });
    return result.text;
  } catch (error) {
    console.error('Error in TextGenerationFromMessages:', error);
    return errorMessage
      ? errorMessage
      : 'Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
  }
}

export function streamTextGenerationFromPromptToResultWithErrorHandler(
  model: LanguageModel,
  prompt: string,
  systemPrompt?: string,
  tools?: ToolSet,
  stopWhen?: number,
  output?: any,
  errorMessage?: string,
  onFinish?: (data) => void
) {
  const stream = createUIMessageStream({
    execute({ writer }) {
      try {
        const result = streamText({
          model: model,
          system: systemPrompt ? systemPrompt : undefined,
          prompt: prompt,
          tools: tools ? tools : undefined,
          stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
          output: output ? output : undefined
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
  onFinish?: (data) => void
) {
  const stream = createUIMessageStream({
    async execute({ writer }) {
      try {
        const result = streamText({
          model: model,
          system: systemPrompt ? systemPrompt : undefined,
          messages: await convertToModelMessages(messages),
          tools: tools ? tools : undefined,
          stopWhen: stepCountIs(stopWhen ? stopWhen : 5),
          output: output ? output : undefined
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
