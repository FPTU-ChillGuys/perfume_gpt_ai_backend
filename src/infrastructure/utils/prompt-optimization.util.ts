import { Logger } from '@nestjs/common';
import { UIMessage } from 'ai';
import { PROMPT_OPTIMIZATION_SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { aiModelForOptimizePrompt } from 'src/chatbot/ai-model';
import { textGenerationFromPromptToResultWithErrorHandler } from 'src/chatbot/chatbot';

export interface PromptOptimizationConfig {
  enablePromptOptimization?: boolean;
  optimizationPrompt?: string;
}

const SHORT_GREETING_REGEX = /^(hi|hello|hey|xin chao|chao|alo)\s*[!.?]*$/i;

export async function optimizePromptWithIntermediateModel(
  originalPrompt: string,
  optimizationConfig?: PromptOptimizationConfig,
  logger?: Logger,
  systemContext?: string
): Promise<string> {
  if (!optimizationConfig?.enablePromptOptimization) {
    return originalPrompt;
  }

  const customOptimizationPrompt = optimizationConfig.optimizationPrompt?.trim();

  try {
    logger?.log('[PromptOptimization] Starting prompt optimization...');
    const optimizedText = await textGenerationFromPromptToResultWithErrorHandler(
      aiModelForOptimizePrompt,
      `${customOptimizationPrompt ? `Case-specific optimization instruction:\n${customOptimizationPrompt}\n\n` : ''}` +
      `System context (reference only):\n${(systemContext || '').slice(0, 1200)}\n\n` +
        `Optimize the following prompt while keeping the same intent and domain.\n` +
        `If the input is Vietnamese, translate it to natural English first.\n` +
        `Output MUST be in English only.\n\n${originalPrompt}`,
      PROMPT_OPTIMIZATION_SYSTEM_PROMPT,
      undefined,
      undefined,
      10,
      undefined,
      0.7,
      undefined
    );
    logger?.log('[PromptOptimization] Prompt optimization completed');
    return optimizedText?.trim() || originalPrompt;
  } catch (error) {
    logger?.warn('[PromptOptimization] Optimization failed, using original prompt', error as Error);
    return originalPrompt;
  }
}

export async function optimizeUserMessageWithIntermediateModel(
  messages: UIMessage[],
  optimizationConfig?: PromptOptimizationConfig,
  logger?: Logger,
  systemContext?: string
): Promise<UIMessage[]> {
  if (!optimizationConfig?.enablePromptOptimization || messages.length === 0) {
    return messages;
  }

  const customOptimizationPrompt = optimizationConfig.optimizationPrompt?.trim();

  try {
    logger?.log('[PromptOptimization] Starting messages optimization...');
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return messages;
    }

    const userText =
      lastMessage.parts?.find((part) => part.type === 'text')?.text || '';
    if (!userText) {
      return messages;
    }

    // Keep very short greetings concise to avoid verbose rewrites.
    if (SHORT_GREETING_REGEX.test(userText.trim())) {
      const greetingWithLanguageHint = `${userText.trim()}\n\nPlease answer in Vietnamese.`;
      logger?.debug('[PromptOptimization] Short greeting detected. Skip expansion and keep concise message.');

      const conciseMessages = [...messages];
      conciseMessages[conciseMessages.length - 1] = {
        ...lastMessage,
        parts: [{ type: 'text', text: greetingWithLanguageHint }]
      };

      return conciseMessages;
    }

    const optimizedText = await textGenerationFromPromptToResultWithErrorHandler(
      aiModelForOptimizePrompt,
      `${customOptimizationPrompt ? `Case-specific optimization instruction:\n${customOptimizationPrompt}\n\n` : ''}` +
      `System context (reference only):\n${(systemContext || '').slice(0, 1200)}\n\n` +
        `Optimize the following user message so the main model can respond better.\n` +
        `Keep the same intent and domain, and do not turn it into generic follow-up questions.\n` +
        `If the input is Vietnamese, translate it to natural English first.\n` +
        `Output MUST be in English only.\n\n${userText}`,
      PROMPT_OPTIMIZATION_SYSTEM_PROMPT,
      undefined,
      undefined,
      10,
      undefined,
      0.7,
      undefined
    );

    logger?.log('[PromptOptimization] Messages optimization completed');
    logger?.debug(`[PromptOptimization] Original user message: "${userText}"`);
    const finalOptimizedText = (optimizedText || userText).trim();
    const messageWithLanguageHint = `${finalOptimizedText}\n\nPlease answer in Vietnamese.`;
    logger?.debug(`[PromptOptimization] Optimized user message: "${messageWithLanguageHint}"`);

    const optimizedMessages = [...messages];
    optimizedMessages[optimizedMessages.length - 1] = {
      ...lastMessage,
      parts: [{ type: 'text', text: messageWithLanguageHint }]
    };

    return optimizedMessages;
  } catch (error) {
    logger?.warn('[PromptOptimization] Messages optimization failed, using original messages', error as Error);
    return messages;
  }
}
