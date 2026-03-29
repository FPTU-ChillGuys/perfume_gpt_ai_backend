import { openai } from "@ai-sdk/openai";
import { EmbeddingModel } from "ai";
import { deepSeek3_2, geminiFlash2_5, geminiFlash3, geminiFlash3_1, gemma3nE4bIt, glm47Flash, gpt5_4nano, gpt5Nano, gptOss120b, gptOss20b, gptOssSafeguard20b, grok_4_1_fast, llama4Scout, llama_3_1_8b_instruct, ministral_14b_2512, ministral_8b_2512, mistral_small_2603, nemotron3Nano30bA3bNitro, qwen3_30b, Step3_5, trinityLargePreview, trinityMini } from "./models/open_router";

export const embeddingModel: EmbeddingModel = openai.embedding('text-embedding-3-small');

export const aiModel = gpt5_4nano;

export const aiModelForSurvey = gpt5_4nano;

export const aiModelForTrend = gpt5_4nano;

export const aiModelForRestock = gpt5_4nano;

export const aiModelForReview = llama_3_1_8b_instruct;

export const aiModelForOptimizePrompt = gpt5_4nano;

export const aiModelForSearch = geminiFlash2_5;

export const aiModelForConversationAnalysis = gemma3nE4bIt;