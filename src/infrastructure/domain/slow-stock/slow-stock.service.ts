import { Injectable } from '@nestjs/common';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
    VariantSalesAnalyticsResponse
} from 'src/application/dtos/response/variant-sales-analytics.response';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { SlowStockRepository } from 'src/infrastructure/domain/slow-stock/slow-stock.repository';
import { SlowStockCandidate, SlowStockVariantCandidate } from 'src/application/dtos/response/slow-stock/slow-stock-analytics.types';
import { SLOW_STOCK_CONFIG, RESTOCK_CONFIG } from 'src/application/constant/inventory.constant';

export type { SlowStockCandidate, SlowStockVariantCandidate };

@Injectable()
export class SlowStockService {
    private readonly slowStockCandidateLimit = SLOW_STOCK_CONFIG.CANDIDATE_LIMIT;

    constructor(
        private readonly slowStockRepo: SlowStockRepository,
        private readonly restockService: RestockService
    ) {}

    async getSlowStockCandidates(): Promise<BaseResponseAPI<SlowStockCandidate[]>> {
        return await funcHandlerAsync(
            async () => {
                const [analyticsResult, stocks] = await Promise.all([
                    this.restockService.getProductSalesAnalyticsForRestock(),
                    this.slowStockRepo.findAllStocksWithRelations()
                ]);

                if (!analyticsResult.success || !analyticsResult.payload) {
                    return {
                        success: false,
                        error: analyticsResult.error ?? 'Failed to fetch sales analytics'
                    };
                }

                const stockMap = this.buildStockMap(stocks);
                const variantsWithStock = this.filterSlowMovingVariants(analyticsResult.payload, stockMap);
                const candidates = this.groupVariantsByProduct(variantsWithStock, stockMap);
                const sorted = this.sortAndLimitCandidates(candidates);

                return { success: true, payload: sorted };
            },
            'Failed to fetch slow stock candidates',
            true
        );
    }

    private buildStockMap(stocks: Awaited<ReturnType<SlowStockRepository['findAllStocksWithRelations']>>): Map<string, {
        totalQuantity: number;
        reservedQuantity: number;
        lowStockThreshold: number;
    }> {
        const stockMap = new Map<string, {
            totalQuantity: number;
            reservedQuantity: number;
            lowStockThreshold: number;
        }>();
        for (const s of stocks) {
            stockMap.set(s.VariantId, {
                totalQuantity: s.TotalQuantity,
                reservedQuantity: s.ReservedQuantity,
                lowStockThreshold: s.LowStockThreshold
            });
        }
        return stockMap;
    }

    private filterSlowMovingVariants(
        variants: VariantSalesAnalyticsResponse[],
        stockMap: Map<string, { totalQuantity: number; reservedQuantity: number; lowStockThreshold: number }>
    ): VariantSalesAnalyticsResponse[] {
        const result: VariantSalesAnalyticsResponse[] = [];
        for (const variant of variants) {
            const stock = stockMap.get(variant.variantId);
            if (!stock) continue;
            if (stock.totalQuantity <= 0) continue;
            if (variant.status === 'Inactive' || variant.status === 'Discontinue') continue;

            const avgDaily = variant.averageDailySales ?? 0;
            const forecastDemand = SLOW_STOCK_CONFIG.FORECAST_RECENT_WEIGHT * avgDaily + SLOW_STOCK_CONFIG.FORECAST_SHORT_TERM_WEIGHT * ((variant.salesMetrics?.last7DaysSales ?? 0) / 7);
            const daysOfSupply = stock.totalQuantity / Math.max(forecastDemand, SLOW_STOCK_CONFIG.MIN_FORECAST_DEMAND);

            if (daysOfSupply > SLOW_STOCK_CONFIG.DAYS_OF_SUPPLY_THRESHOLD) {
                result.push(variant);
            }
        }
        return result;
    }

    private groupVariantsByProduct(
        variants: VariantSalesAnalyticsResponse[],
        stockMap: Map<string, { totalQuantity: number; reservedQuantity: number; lowStockThreshold: number }>
    ): SlowStockCandidate[] {
        const byProduct = new Map<string, SlowStockCandidate>();

        for (const variant of variants) {
            const stock = stockMap.get(variant.variantId)!;
            const key = variant.productName;

            const current = byProduct.get(key) ?? {
                productName: variant.productName,
                variantCount: 0,
                averageDailySales: 0,
                last7DaysSales: 0,
                last30DaysSales: 0,
                salesTrend: 'STABLE' as const,
                volatility: 'LOW' as const,
                variants: []
            };

            current.variantCount += 1;
            current.averageDailySales += variant.averageDailySales ?? 0;
            current.last7DaysSales += variant.salesMetrics?.last7DaysSales ?? 0;
            current.last30DaysSales += variant.salesMetrics?.last30DaysSales ?? 0;
            current.variants.push({
                variantId: variant.variantId,
                sku: variant.sku,
                volumeMl: variant.volumeMl,
                basePrice: variant.basePrice,
                status: variant.status,
                totalQuantity: stock.totalQuantity,
                reservedQuantity: stock.reservedQuantity,
                lowStockThreshold: stock.lowStockThreshold,
                averageDailySales: variant.averageDailySales ?? 0,
                last7DaysSales: variant.salesMetrics?.last7DaysSales ?? 0,
                last30DaysSales: variant.salesMetrics?.last30DaysSales ?? 0,
                trend: variant.salesMetrics?.trend ?? 'STABLE',
                volatility: variant.salesMetrics?.volatility ?? 'LOW'
            });

            byProduct.set(key, current);
        }

        return this.computeCandidateAggregates(Array.from(byProduct.values()));
    }

    private computeCandidateAggregates(candidates: SlowStockCandidate[]): SlowStockCandidate[] {
        candidates.forEach((item) => {
            const avgLast30 = item.last30DaysSales / Math.max(item.variantCount, 1) / 4;
            const avgLast7 = item.last7DaysSales / Math.max(item.variantCount, 1);
            if (avgLast7 < avgLast30 * RESTOCK_CONFIG.TREND_DECLINING_THRESHOLD) {
                item.salesTrend = 'DECLINING';
            } else if (avgLast7 > avgLast30 * RESTOCK_CONFIG.TREND_INCREASING_THRESHOLD) {
                item.salesTrend = 'INCREASING';
            } else {
                item.salesTrend = 'STABLE';
            }

            const volatilities = item.variants.map((v) => v.volatility);
            if (volatilities.includes('HIGH')) {
                item.volatility = 'HIGH';
            } else if (volatilities.includes('MEDIUM')) {
                item.volatility = 'MEDIUM';
            } else {
                item.volatility = 'LOW';
            }

            item.averageDailySales = Number(item.averageDailySales.toFixed(2));
        });
        return candidates;
    }

    private sortAndLimitCandidates(candidates: SlowStockCandidate[]): SlowStockCandidate[] {
        return candidates
            .sort((a, b) => {
                const aForecast = SLOW_STOCK_CONFIG.FORECAST_RECENT_WEIGHT * (a.averageDailySales / a.variantCount) + SLOW_STOCK_CONFIG.FORECAST_SHORT_TERM_WEIGHT * (a.last7DaysSales / 7 / a.variantCount);
                const bForecast = SLOW_STOCK_CONFIG.FORECAST_RECENT_WEIGHT * (b.averageDailySales / b.variantCount) + SLOW_STOCK_CONFIG.FORECAST_SHORT_TERM_WEIGHT * (b.last7DaysSales / 7 / b.variantCount);
                return aForecast - bForecast;
            })
            .slice(0, this.slowStockCandidateLimit);
    }
}