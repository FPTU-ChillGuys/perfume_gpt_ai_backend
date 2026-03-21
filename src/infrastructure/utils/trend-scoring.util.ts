import { PeriodEnum } from 'src/domain/enum/period.enum';

export type SalesTrend = 'INCREASING' | 'STABLE' | 'DECLINING';
export type SalesVolatility = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TrendScoreInput {
  isBestSeller: boolean;
  bestSellerRank?: number;
  isNewest: boolean;
  newestRank?: number;
  last7DaysSales: number;
  last30DaysSales: number;
  salesTrend: SalesTrend;
  volatility: SalesVolatility;
  behaviorTotalEvents: number;
  snapshotMentioned: boolean;
}

export interface TrendScoreResult {
  trendScore: number;
  confidence: number;
  reasonCodes: string[];
  signalDeltas: {
    base: number;
    momentum: number;
    salesTrend: number;
    volatilityPenalty: number;
    bestSellerBoost: number;
    newestBoost: number;
    behaviorBoost: number;
    snapshotBoost: number;
  };
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const getBehaviorBoostCap = (period: PeriodEnum): number => {
  if (period === PeriodEnum.WEEKLY) {
    return 8;
  }

  if (period === PeriodEnum.YEARLY) {
    return 14;
  }

  return 10;
};

const getMomentumScore = (last7DaysSales: number, last30DaysSales: number): number => {
  if (last7DaysSales <= 0 && last30DaysSales <= 0) {
    return 0;
  }

  const expectedWeekFromMonth = last30DaysSales > 0 ? last30DaysSales / 4 : 0;
  if (expectedWeekFromMonth <= 0) {
    return 10;
  }

  const momentumRatio = last7DaysSales / expectedWeekFromMonth;

  if (momentumRatio >= 1.4) {
    return 18;
  }

  if (momentumRatio >= 1.1) {
    return 12;
  }

  if (momentumRatio >= 0.9) {
    return 8;
  }

  if (momentumRatio >= 0.7) {
    return 4;
  }

  return 0;
};

const getSalesTrendBoost = (salesTrend: SalesTrend): number => {
  if (salesTrend === 'INCREASING') {
    return 10;
  }

  if (salesTrend === 'DECLINING') {
    return -8;
  }

  return 4;
};

const getVolatilityPenalty = (volatility: SalesVolatility): number => {
  if (volatility === 'HIGH') {
    return -8;
  }

  if (volatility === 'MEDIUM') {
    return -4;
  }

  return 0;
};

const getBestSellerBoost = (isBestSeller: boolean, bestSellerRank?: number): number => {
  if (!isBestSeller) {
    return 0;
  }

  const rank = (bestSellerRank ?? 10) + 1;
  return clamp(22 - rank * 2, 8, 20);
};

const getNewestBoost = (isNewest: boolean, newestRank?: number): number => {
  if (!isNewest) {
    return 0;
  }

  const rank = (newestRank ?? 10) + 1;
  return clamp(14 - rank, 4, 12);
};

const getBehaviorBoost = (behaviorTotalEvents: number, period: PeriodEnum): number => {
  if (behaviorTotalEvents <= 0) {
    return 0;
  }

  const cap = getBehaviorBoostCap(period);
  const raw = Math.log10(behaviorTotalEvents + 1) * 4;
  return clamp(Number(raw.toFixed(2)), 0, cap);
};

export const calculateTrendScore = (
  input: TrendScoreInput,
  period: PeriodEnum
): TrendScoreResult => {
  const base = 30;
  const momentum = getMomentumScore(input.last7DaysSales, input.last30DaysSales);
  const salesTrend = getSalesTrendBoost(input.salesTrend);
  const volatilityPenalty = getVolatilityPenalty(input.volatility);
  const bestSellerBoost = getBestSellerBoost(input.isBestSeller, input.bestSellerRank);
  const newestBoost = getNewestBoost(input.isNewest, input.newestRank);
  const behaviorBoost = getBehaviorBoost(input.behaviorTotalEvents, period);
  const snapshotBoost = input.snapshotMentioned ? 5 : 0;

  const rawScore =
    base +
    momentum +
    salesTrend +
    volatilityPenalty +
    bestSellerBoost +
    newestBoost +
    behaviorBoost +
    snapshotBoost;

  const trendScore = clamp(Math.round(rawScore), 0, 100);

  const reasonCodes: string[] = [];

  if (bestSellerBoost > 0) {
    reasonCodes.push('BEST_SELLER_SUPPORT');
  }

  if (newestBoost >= 8) {
    reasonCodes.push('NEW_ARRIVAL_BOOST');
  }

  if (momentum >= 12) {
    reasonCodes.push('SALES_MOMENTUM_UP');
  }

  if (input.salesTrend === 'INCREASING') {
    reasonCodes.push('SALES_TREND_INCREASING');
  }

  if (behaviorBoost >= 6) {
    reasonCodes.push('USER_INTEREST_SIGNAL');
  }

  if (input.snapshotMentioned) {
    reasonCodes.push('RECENT_TREND_SNAPSHOT_MATCH');
  }

  if (input.volatility === 'HIGH') {
    reasonCodes.push('VOLATILITY_RISK');
  }

  const positiveSignals = reasonCodes.filter((reason) => reason !== 'VOLATILITY_RISK').length;
  const confidence = clamp(40 + positiveSignals * 10 + (input.behaviorTotalEvents > 0 ? 5 : 0), 35, 95);

  return {
    trendScore,
    confidence,
    reasonCodes,
    signalDeltas: {
      base,
      momentum,
      salesTrend,
      volatilityPenalty,
      bestSellerBoost,
      newestBoost,
      behaviorBoost,
      snapshotBoost
    }
  };
};
