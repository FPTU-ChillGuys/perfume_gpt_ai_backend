import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { embed } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!
});

/**
 * Embedding model cho vector search trong Hybrid Search v4
 * Sử dụng FPT Cloud Embedding (1024 dimensions)
 */
export const embeddingModel: any = openrouter.textEmbeddingModel('openai/text-embedding-3-small');

/**
 * Generate embedding cho text input
 * @param text - Text cần embed
 * @returns Promise<number[]> - Vector embedding (1024 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embed({
    model: embeddingModel,
    value: text,
  });
  return result.embedding;
}
