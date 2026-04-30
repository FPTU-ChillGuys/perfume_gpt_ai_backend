import { TrendSeedStage } from 'src/application/dtos/trend/trend-seed-keyword.type';

export type GoogleTrendSignal = {
  keyword: string;
  score: number;
  source: 'interest_over_time' | 'related_query';
  stage: TrendSeedStage;
  parentKeyword?: string;
};