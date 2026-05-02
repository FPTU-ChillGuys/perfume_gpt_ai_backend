import { ProductCardResponse } from 'src/application/dtos/response/product-card.response';
import { GoogleTrendSignal } from 'src/application/dtos/trend/google-trend-signal.type';
import { TrendKeywordMapperResult } from 'src/application/dtos/trend/trend-keyword-mapper-result.type';

export type TrendPipelineSource =
  | 'live-google'
  | 'cache'
  | 'trend-log'
  | 'empty';

export type TrendPipelineResult = {
  products: ProductCardResponse[];
  keywordsUsed: string[];
  sourceUsed: TrendPipelineSource;
  fallbackTier: 'none' | 'cache' | 'trend-log' | 'empty';
  googleSignals: GoogleTrendSignal[];
  mapperResult: TrendKeywordMapperResult;
};
