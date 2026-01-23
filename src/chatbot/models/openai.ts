import { openai } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';

export const gpt5nano: LanguageModel = openai('gpt-5-nano');
