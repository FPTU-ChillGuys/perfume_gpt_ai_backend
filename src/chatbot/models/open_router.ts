import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModel } from 'ai';

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!
});

export const geminiFlash3_1: LanguageModel = openrouter(
  'google/gemini-3.1-flash-lite-preview'
);

export const geminiFlash3: LanguageModel = openrouter(
  'google/gemini-3-flash-preview'
);

export const geminiFlash2_5: LanguageModel = openrouter(
  'google/gemini-2.5-flash-lite'
);

export const Step3_5: LanguageModel = openrouter('stepfun/step-3.5-flash:free');

export const gptOss120b: LanguageModel = openrouter(
  'openai/gpt-oss-120b:exacto'
);

export const trinityLargePreview: LanguageModel = openrouter(
  'arcee-ai/trinity-large-preview:free'
);

export const gemma3nE4bIt: LanguageModel = openrouter('google/gemma-3n-e4b-it');

export const gemma3n27b: LanguageModel = openrouter('google/gemma-3-27b-it');

export const gptOssSafeguard20b: LanguageModel = openrouter(
  'openai/gpt-oss-safeguard-20b'
);

export const trinityMini: LanguageModel = openrouter('arcee-ai/trinity-mini');

export const nemotron3Nano30bA3bNitro: LanguageModel = openrouter(
  'nvidia/nemotron-3-nano-30b-a3b:nitro'
);

export const gpt5Nano: LanguageModel = openrouter('openai/gpt-5-nano');

export const glm47Flash: LanguageModel = openrouter('z-ai/glm-4.7-flash:nitro');

export const qwen3_30b: LanguageModel = openrouter('qwen/qwen3-30b-a3b');

export const llama4Scout: LanguageModel = openrouter(
  'meta-llama/llama-4-scout'
);

export const deepSeek3_2: LanguageModel = openrouter('deepseek/deepseek-v3.2');

export const ministral_8b_2512: LanguageModel = openrouter(
  'mistralai/ministral-8b-2512'
);

export const ministral_14b_2512: LanguageModel = openrouter(
  'mistralai/ministral-14b-2512'
);

export const gemma_3n_4B: LanguageModel = openrouter('google/gemma-3n-e4b-it');

export const gpt5_4nano: LanguageModel = openrouter('openai/gpt-5.4-nano');

export const grok_4_1_fast: LanguageModel = openrouter('x-ai/grok-4.1-fast');

export const llama_3_1_8b_instruct: LanguageModel = openrouter(
  'meta-llama/llama-3.1-8b-instruct'
);

export const mistral_small_2603: LanguageModel = openrouter(
  'mistralai/mistral-small-2603'
);

export const trinityMiniFree: LanguageModel = openrouter(
  'arcee-ai/trinity-mini:free'
);

export const gptOss20b: LanguageModel = openrouter('openai/gpt-oss-20b');

export const qwen3_6PlusPreview: LanguageModel = openrouter(
  'qwen/qwen3.6-plus-preview:free'
);

export const gemma4: LanguageModel = openrouter(
  'google/gemma-4-26b-a4b-it:exacto'
);

export const gemma431B: LanguageModel = openrouter('google/gemma-4-31b-it');

export const qwen3_5_flash: LanguageModel = openrouter(
  'qwen/qwen3.5-flash-02-23'
);

export const seed1_6: LanguageModel = openrouter(
  'bytedance-seed/seed-1.6-flash'
);
