export interface VectorSearchResult {
  productId: string;
  similarity: number;
}

export interface RerankCandidate {
  text: string;
  [key: string]: unknown;
}

export interface EmbeddingStats {
  total: number;
  lastRebuild?: string;
}