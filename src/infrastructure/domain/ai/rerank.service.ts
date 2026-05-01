import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface RerankResult {
  index: number;
  relevance_score: number;
}

@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/rerank';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
  }

  /**
   * Rerank a list of documents based on a query
   * @param query - The user search query
   * @param documents - Array of documents to rerank (should have a 'text' property)
   * @param topN - Number of top results to return
   * @returns The reranked documents with their scores
   */
  async rerank<T extends { text: string }>(
    query: string,
    documents: T[],
    topN: number = 20
  ): Promise<(T & { rerankScore: number })[]> {
    if (!documents || documents.length === 0) return [];
    if (!this.apiKey) {
      this.logger.warn(
        '[RerankService] OPENROUTER_API_KEY is not set. Skipping rerank.'
      );
      return documents
        .slice(0, topN)
        .map((doc) => ({ ...doc, rerankScore: 1 }));
    }

    try {
      this.logger.log(
        `[RerankService] Reranking ${documents.length} candidates for query: "${query}"`
      );

      // Prepare request for OpenRouter using HttpService
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            model: 'cohere/rerank-v3.5',
            query: query,
            documents: documents.map((doc) => doc.text),
            top_n: topN
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      const results: RerankResult[] = response.data.results;

      // Map results back to original documents
      const reranked = results.map((res) => {
        const originalDoc = documents[res.index];
        return {
          ...originalDoc,
          rerankScore: res.relevance_score
        };
      });

      this.logger.log(
        `[RerankService] Rerank completed. Top score: ${reranked[0]?.rerankScore || 0}`
      );

      return reranked;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[RerankService] Rerank failed: ${errorMessage}`,
        error.stack
      );

      // Fallback: return top documents without rerank scores
      return documents
        .slice(0, topN)
        .map((doc) => ({ ...doc, rerankScore: 0 }));
    }
  }
}
