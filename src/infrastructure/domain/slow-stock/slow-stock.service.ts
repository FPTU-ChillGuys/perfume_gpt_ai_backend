import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
    VariantSalesAnalyticsResponse,
    DailySalesRecord
} from 'src/application/dtos/response/variant-sales-analytics.response';
import { RestockService, ProductSalesAnalyticsCandidate } from 'src/infrastructure/domain/restock/restock.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { calculateSalesMetrics } from 'src/infrastructure/domain/utils/sales-metrics.util';

export interface SlowStockCandidate {
    productName: string;
    variantCount: number;
    averageDailySales: number;
    last7DaysSales: number;
    last30DaysSales: number;
    salesTrend: 'INCREASING' | 'STABLE' | 'DECLINING';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    variants: SlowStockVariantCandidate[];
}

export interface SlowStockVariantCandidate {
    variantId: string;
    sku: string;
    volumeMl: number;
    basePrice: number;
    status: string;
    totalQuantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
    averageDailySales: number;
    last7DaysSales: number;
    last30DaysSales: number;
    trend: 'INCREASING' | 'STABLE' | 'DECLINING';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class SlowStockService {
    private readonly slowStockCandidateLimit = 30;

    constructor(
        private readonly prisma: PrismaService,
        private readonly restockService: RestockService
    ) {}

    async getSlowStockCandidates(): Promise<BaseResponseAPI<SlowStockCandidate[]>> {
        return await funcHandlerAsync(
            async () => {
                const [analyticsResult, stocks] = await Promise.all([
                    this.restockService.getProductSalesAnalyticsForRestock(),
                    this.prisma.stocks.findMany({
                        where: {
                            ProductVariants: {
                                IsDeleted: false,
                                Products: { IsDeleted: false }
                            }
                        },
                        include: {
                            ProductVariants: {
                                include: { Products: true, Concentrations: true }
                            }
                        }
                    })
                ]);

                if (!analyticsResult.success || !analyticsResult.payload) {
                    return {
                        success: false,
                        error: analyticsResult.error ?? 'Failed to fetch sales analytics'
                    };
                }

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

                const salesData = analyticsResult.payload;
                const variantsWithStock: VariantSalesAnalyticsResponse[] = [];

                for (const variant of salesData) {
                    const stock = stockMap.get(variant.variantId);
                    if (!stock) continue;
                    if (stock.totalQuantity <= 0) continue;
                    if (variant.status === 'Inactive' || variant.status === 'Discontinue') continue;

                    const avgDaily = variant.averageDailySales ?? 0;
                    const forecastDemand = 0.7 * avgDaily + 0.3 * ((variant.salesMetrics?.last7DaysSales ?? 0) / 7);
                    const daysOfSupply = stock.totalQuantity / Math.max(forecastDemand, 0.01);

                    if (daysOfSupply > 60) {
                        variantsWithStock.push(variant);
                    }
                }

                const byProduct = new Map<string, SlowStockCandidate>();

                for (const variant of variantsWithStock) {
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

                const candidates = Array.from(byProduct.values())
                    .sort((a, b) => {
                        const aForecast = 0.7 * (a.averageDailySales / a.variantCount) + 0.3 * (a.last7DaysSales / 7 / a.variantCount);
                        const bForecast = 0.7 * (b.averageDailySales / b.variantCount) + 0.3 * (b.last7DaysSales / 7 / b.variantCount);
                        return aForecast - bForecast;
                    })
                    .slice(0, this.slowStockCandidateLimit);

                candidates.forEach((item) => {
                    const avgLast30 = item.last30DaysSales / Math.max(item.variantCount, 1) / 4;
                    const avgLast7 = item.last7DaysSales / Math.max(item.variantCount, 1);
                    if (avgLast7 < avgLast30 * 0.85) {
                        item.salesTrend = 'DECLINING';
                    } else if (avgLast7 > avgLast30 * 1.15) {
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

                return {
                    success: true,
                    payload: candidates
                };
            },
            'Failed to fetch slow stock candidates',
            true
        );
    }
}