import { ProductCardResponse } from 'src/application/dtos/response/product-card.response';
import { GoogleTrendSignal } from 'src/application/dtos/trend/google-trend-signal.type';
import { TrendKeywordMapperResult } from 'src/application/dtos/trend/trend-keyword-mapper-result.type';
import { TrendPipelineSource } from 'src/application/dtos/trend/trend-pipeline-result.type';

export type TrendProductsCachePayload = {
  version: 'trend-v2';
  generatedAt: string;
  products: ProductCardResponse[];
  keywordsUsed: string[];
  sourceUsed: TrendPipelineSource;
  fallbackTier: 'none' | 'cache' | 'trend-log' | 'empty';
  googleSignals: GoogleTrendSignal[];
  mapperResult: TrendKeywordMapperResult;
};
