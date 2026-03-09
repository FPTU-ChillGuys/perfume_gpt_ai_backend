import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LanguageModel } from "ai";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const geminiFlash3_1 : LanguageModel = openrouter("google/gemini-3.1-flash-lite-preview");

export const geminiFlash3 : LanguageModel = openrouter("google/gemini-3-flash-preview");

export const geminiFlash2_5 : LanguageModel = openrouter("google/gemini-2.5-flash-lite");

export const Step3_5 : LanguageModel = openrouter("stepfun/step-3.5-flash:free");

export const gptOss120b : LanguageModel = openrouter("openai/gpt-oss-120b:exacto");

export const trinityLargePreview : LanguageModel = openrouter("arcee-ai/trinity-large-preview:free");

export const gemma3nE4bIt : LanguageModel = openrouter("google/gemma-3n-e4b-it");

export const gptOssSafeguard20b : LanguageModel = openrouter("openai/gpt-oss-safeguard-20b");

export const trinityMini : LanguageModel = openrouter("arcee-ai/trinity-mini");

export const nemotron3Nano30bA3bNitro : LanguageModel = openrouter("nvidia/nemotron-3-nano-30b-a3b:nitro");

export const gpt5Nano : LanguageModel = openrouter("openai/gpt-5-nano");

export const glm47Flash : LanguageModel = openrouter("z-ai/glm-4.7-flash:nitro");

export const qwen3_30b_a3b_Thinking_2507 : LanguageModel = openrouter("qwen/qwen3-30b-a3b-thinking-2507:nitro");

export const llama4Scout : LanguageModel = openrouter("meta-llama/llama-4-scout");