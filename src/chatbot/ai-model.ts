import { deepSeek3_2, geminiFlash2_5, geminiFlash3, gemma3nE4bIt, glm47Flash, gpt5_4nano, gpt5Nano, gptOss120b, gptOssSafeguard20b, grok_4_1_fast, llama4Scout, llama_3_1_8b_instruct, ministral_14b_2512, ministral_8b_2512, nemotron3Nano30bA3bNitro, qwen3_30b, Step3_5, trinityLargePreview, trinityMini } from "./models/open_router";

export const aiModel = gpt5_4nano;

export const aiModelForSurvey = grok_4_1_fast;

export const aiModelForTrend = gpt5_4nano;

export const aiModelForRestock = gpt5_4nano;

export const aiModelForReview = llama_3_1_8b_instruct;

export const aiModelForOptimizePrompt = gemma3nE4bIt;
