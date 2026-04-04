/**
 * RecommendationV2Service
 * Intelligent product recommendation system based on:
 * - Purchase history (last 2 years)
 * - Seasonal preferences
 * - Survey responses
 * - Dynamic age calculation
 * - Budget patterns
 * - Repurchase frequency
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product.service';
import { UserLogService } from '../user-log/user-log.service';
import {
  RecommendationProfile,
  ProductScore,
  RecommendationResponse,
  ProductVariantInfo,
  OrderWithProducts,
  ScoresWeights,
  DEFAULT_WEIGHTS,
  Season
} from './recommendation-profile.type';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { isAfter, isWithinInterval, subMonths, subYears, differenceInDays } from 'date-fns';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';

@Injectable()
export class RecommendationV2Service {
  private readonly logger = new Logger(RecommendationV2Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
    private readonly userLogService: UserLogService
  ) {}

  /**
   * Main entry point: Get recommendations for a user
   */
  async getRecommendations(
    userIdRaw: string,
    size: number = 10,
    chatContext?: AnalysisObject,
    weights?: Partial<ScoresWeights>
  ): Promise<BaseResponse<RecommendationResponse>> {
    try {
      const userId = userIdRaw.toLowerCase();
      this.logger.log(`[START] Getting recommendations for user: ${userId}, size: ${size}`);

      // Step 1: Build user profile
      const profile = await this.buildUserRecommendationProfile(userId);
      this.logger.log(`[PROFILE] Mode: ${profile.recommendationMode}`);
      this.logger.log(`[PROFILE] Age: ${profile.dynamicAge}, Season: ${profile.currentSeason}, Budget: ${profile.monthlyBudgetAvg}VND`);
      this.logger.log(`[PROFILE] Top Brands: ${profile.topBrands.join(', ')}`);
      this.logger.log(`[PROFILE] Top Scents: ${profile.topScents.join(', ')}`);

      const hasPersonalizationSignals =
        profile.topBrands.length > 0 ||
        profile.topScents.length > 0 ||
        profile.topGenders.length > 0 ||
        profile.surveyTopScents.length > 0 ||
        profile.surveyTopOccasions.length > 0 ||
        Object.keys(profile.repurchaseFrequencyMap || {}).length > 0;

      if (!hasPersonalizationSignals) {
        this.logger.warn(
          `[FALLBACK] No personalization signals for user ${userId}. Returning best sellers directly.`
        );
        return {
          success: true,
          data: {
            userId,
            recommendations: await this.getBestSellersFallback(size, chatContext),
            totalProducts: 0,
            profile: {
              dynamicAge: profile.dynamicAge,
              currentSeason: profile.currentSeason,
              monthlyBudgetAvg: profile.monthlyBudgetAvg,
              topBrands: profile.topBrands,
              topScents: profile.topScents
            }
          }
        };
      }

      // Step 2: Generate candidate products
      const candidates = await this.generateCandidateProducts(profile);
      this.logger.log(`[CANDIDATES] Found ${candidates.length} candidate products`);

      if (candidates.length === 0) {
        this.logger.warn(`[FALLBACK] No candidates found, using best sellers`);
        // Fallback: return best sellers
        return {
          success: true,
          data: {
            userId,
            recommendations: await this.getBestSellersFallback(size, chatContext),
            totalProducts: 0,
            profile: {
              dynamicAge: profile.dynamicAge,
              currentSeason: profile.currentSeason,
              monthlyBudgetAvg: profile.monthlyBudgetAvg,
              topBrands: profile.topBrands,
              topScents: profile.topScents
            }
          }
        };
      }

      // Step 3: Score and rank products
      const scoredProducts = candidates.map((product) =>
        this.scoreProduct(product, profile, chatContext, weights)
      );

      const uniqueScoredProducts = this.deduplicateProductScores(scoredProducts);
      
      // Log top 10 scores for debugging
      const top10 = uniqueScoredProducts.sort((a, b) => b.score - a.score).slice(0, 10);
      this.logger.log(`[SCORING] Top 10 scores: ${top10.map(p => `${p.productName}(${p.score.toFixed(2)})`).join(', ')}`);

      // Step 4: Apply budget exploration (Allow 20% premium out of bounds)
      let budgetFiltered = uniqueScoredProducts;
      if (chatContext && chatContext.budget && Number.isFinite(chatContext.budget.max ?? NaN)) {
        // Hard constraint if AI strictly captured a budget
        const maxB = chatContext.budget.max;
        budgetFiltered = uniqueScoredProducts.filter(p => p.basePrice && p.basePrice <= (maxB ?? 0));
      } else {
        // Budget exploration: 80% strict match, 20% slight upsell allowed (+30% price)
        budgetFiltered = uniqueScoredProducts.filter(
          (p) => p.basePrice && p.basePrice <= profile.maxBudgetMonthly * 1.3
        );
      }
      
      this.logger.log(`[BUDGET FILTER] ${uniqueScoredProducts.length} → ${budgetFiltered.length}`);

      // Sort by score BEFORE diversity
      const sorted = budgetFiltered.sort((a, b) => b.score - a.score);

      // Phase 2 Filter: Diversity (Max 2 per brand or olfactory family)
      const diversified: ProductScore[] = [];
      const brandCount: Record<string, number> = {};
      const familyCount: Record<string, number> = {};
      
      for (const p of sorted) {
        const b = p.brand || 'Unbranded';
        const f = p.olfactoryFamilies?.[0] || 'Unknown';
        
        if ((brandCount[b] || 0) < 2 && (familyCount[f] || 0) < 2) {
          diversified.push(p);
          brandCount[b] = (brandCount[b] || 0) + 1;
          familyCount[f] = (familyCount[f] || 0) + 1;
        }
        
        if (diversified.length >= size) break;
      }

      // Fallback if not enough after filters
      let final = diversified;
      if (final.length < size) {
        const fallbacks = await this.getBestSellersFallback(size - final.length, chatContext);
        final = [...final, ...fallbacks].slice(0, size);
      }
      
      this.logger.log(`[FINAL] Returning size=${size} products: ${final.map(p => p.productName).join(', ')}`);

      return {
        success: true,
        data: {
          userId,
          recommendations: final,
          totalProducts: candidates.length,
          profile: {
            dynamicAge: profile.dynamicAge,
            currentSeason: profile.currentSeason,
            monthlyBudgetAvg: profile.monthlyBudgetAvg,
            topBrands: profile.topBrands,
            topScents: profile.topScents
          }
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get recommendations for user ${userIdRaw}:`, error);
      return {
        success: false,
        error: 'Failed to generate recommendations'
      };
    }
  }

  /**
   * Build complete user profile from all available data sources
   */
  async buildUserRecommendationProfile(
    userIdRaw: string
  ): Promise<RecommendationProfile> {
    const userId = userIdRaw.toLowerCase();
    this.logger.log(`[PROFILE-BUILD] Starting for user: ${userId}`);

    const [user, orders, userSummaryRaw] = await Promise.all([
      this.userService.getUserById(userId).catch(() => null),
      this.getOrdersForUser(userId),
      this.userLogService
        .getUserLogSummaryByUserId(userId)
        .catch(() => ({ success: false, data: null }))
    ]);

    let userSummary = userSummaryRaw;
    const rollingSnapshot = (userSummary?.data as any)?.featureSnapshot;
    const hasUsableRollingSnapshot =
      Boolean(rollingSnapshot) &&
      (Object.keys(rollingSnapshot?.eventTypeCounts || {}).length > 0 ||
        Object.keys(rollingSnapshot?.merged?.brand || {}).length > 0 ||
        Object.keys(rollingSnapshot?.merged?.scent || {}).length > 0 ||
        Object.keys(rollingSnapshot?.merged?.gender || {}).length > 0);

    if (!hasUsableRollingSnapshot) {
      this.logger.log(
        `[PROFILE-BUILD] Rolling summary missing, fallback to on-demand monthly summary for user ${userId}`
      );
      userSummary = await this.userLogService
        .getUserLogSummaryByUserId(userId, PeriodEnum.MONTHLY)
        .catch(() => ({ success: false, data: null }));
    }

    this.logger.log(
      `[PROFILE-BUILD] Summary source: ${hasUsableRollingSnapshot ? 'rolling' : 'monthly-fallback'}, success=${userSummary?.success ? 'true' : 'false'}`
    );

    this.logger.log(`[PROFILE-BUILD] Found ${orders.length} orders from last 2 years`);

    // Extract preferences from orders
    const preferences = this.extractPreferencesFromOrders(orders);
    const summaryPreferences = this.extractPreferencesFromUserSummary(
      userSummary?.success ? (userSummary.data as any) : null
    );
    const repurchaseMap = this.calculateRepurchaseFrequencies(orders);

    const hasOrderSignals =
      preferences.topBrands.length > 0 ||
      preferences.topScents.length > 0 ||
      preferences.topGenders.length > 0 ||
      Object.keys(repurchaseMap || {}).length > 0;

    const hasSummarySignals =
      summaryPreferences.topBrands.length > 0 ||
      summaryPreferences.topScents.length > 0 ||
      summaryPreferences.topGenders.length > 0 ||
      summaryPreferences.surveyTopScents.length > 0 ||
      summaryPreferences.surveyTopOccasions.length > 0 ||
      summaryPreferences.surveyTopStyles.length > 0;

    const recommendationMode = hasOrderSignals && hasSummarySignals
      ? 'hybrid'
      : hasOrderSignals
        ? 'warm-user'
        : 'cold-start';

    const topBrands = this.resolvePreferenceSignals(
      recommendationMode,
      preferences.topBrands,
      summaryPreferences.topBrands
    );
    const topScents = this.resolvePreferenceSignals(
      recommendationMode,
      preferences.topScents,
      summaryPreferences.topScents
    );
    const topGenders = this.resolvePreferenceSignals(
      recommendationMode,
      preferences.topGenders,
      summaryPreferences.topGenders
    );
    const topOccasions = this.resolvePreferenceSignals(
      recommendationMode,
      preferences.topOccasions,
      summaryPreferences.topOccasions
    );
    const topPriceRanges = this.resolvePreferenceSignals(
      recommendationMode,
      preferences.topPriceRanges,
      summaryPreferences.topPriceRanges
    );

    this.logger.log(
      `[PROFILE-BUILD] Preferences extracted: ` +
      `OrdersBrands=${preferences.topBrands.join(',') || 'n/a'}, ` +
      `OrdersScents=${preferences.topScents.join(',') || 'n/a'}, ` +
      `SummaryBrands=${summaryPreferences.topBrands.join(',') || 'n/a'}, ` +
      `SummaryScents=${summaryPreferences.topScents.join(',') || 'n/a'}`
    );

    // Calculate dynamic age
    const dynamicAge = await this.calculateDynamicAge(userId);
    this.logger.log(`[PROFILE-BUILD] Dynamic age: ${dynamicAge}`);

    // Calculate budget from order history
    const budgetInfo = this.calculateMonthlyBudget(orders);
    this.logger.log(`[PROFILE-BUILD] Budget: min=${budgetInfo.min}, avg=${budgetInfo.avg}, max=${budgetInfo.max}`);

    // Detect current season
    const currentSeason = this.detectCurrentSeason();
    this.logger.log(`[PROFILE-BUILD] Current season: ${currentSeason}`);

    // Extract survey preferences
    const surveyPrefs = this.extractSurveyPreferences(
      userSummary?.success ? (userSummary.data as any) : null
    );
    this.logger.log(`[PROFILE-BUILD] Survey prefs: Scents=${surveyPrefs.scents.join(',')}, Occasions=${surveyPrefs.occasions.join(',')}`);

    this.logger.log(`[PROFILE-BUILD] Repurchase products count: ${Object.keys(repurchaseMap).length}`);

    return {
      userId,
      recommendationMode,
      dynamicAge,
      gender: topGenders[0],
      topBrands,
      topScents,
      topGenders,
      topOccasions,
      topPriceRanges,
      monthlyBudgetAvg: budgetInfo.avg,
      minBudgetMonthly: budgetInfo.min,
      maxBudgetMonthly: budgetInfo.max,
      currentSeason,
      surveyTopScents: surveyPrefs.scents.length > 0 ? surveyPrefs.scents : summaryPreferences.surveyTopScents,
      surveyTopOccasions: surveyPrefs.occasions.length > 0 ? surveyPrefs.occasions : summaryPreferences.surveyTopOccasions,
      surveyTopStyles: surveyPrefs.styles.length > 0 ? surveyPrefs.styles : summaryPreferences.surveyTopStyles,
      repurchaseFrequencyMap: repurchaseMap
    };
  }

  private resolvePreferenceSignals(mode: 'cold-start' | 'warm-user' | 'hybrid', orderSignals: string[], summarySignals: string[]): string[] {
    if (mode === 'warm-user') {
      return orderSignals;
    }

    if (mode === 'cold-start') {
      return summarySignals;
    }

    return Array.from(new Set([...orderSignals, ...summarySignals]));
  }

  /**
   * Get orders for user in last 2 years
   */
  private async getOrdersForUser(userId: string): Promise<OrderWithProducts[]> {
    const twoYearsAgo = subYears(new Date(), 2);

    const orders = await this.prisma.orders.findMany({
      where: {
        CustomerId: userId,
        CreatedAt: { gte: twoYearsAgo },
        Status: { in: ['Delivered', 'Completed'] } // Only completed orders
      },
      include: {
        OrderDetails: {
          include: {
            ProductVariants: {
              include: {
                Products: {
                  include: {
                    Brands: true,
                    ProductFamilyMaps: {
                      include: {
                        OlfactoryFamilies: true
                      }
                    },
                    ProductNoteMaps: {
                      include: {
                        ScentNotes: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    return orders.map((order: any) => ({
      orderId: order.id ?? order.Id,
      customerId: order.CustomerId ?? order.customerId,
      createdAt: order.CreatedAt ?? order.createdAt,
      totalAmount: Number(order.TotalAmount ?? order.totalAmount ?? 0),
      orderDetails: (order.OrderDetails ?? order.orderDetails ?? []).map((detail: any) => ({
        quantity: Number(detail.Quantity ?? detail.quantity ?? 0),
        unitPrice: Number(detail.UnitPrice ?? detail.unitPrice ?? 0),
        productVariant: {
          id: detail.ProductVariants?.Id ?? detail.productVariant?.id,
          VolumeMl: detail.ProductVariants?.VolumeMl ?? detail.productVariant?.VolumeMl ?? detail.productVariant?.volumeMl ?? 0,
          BasePrice: detail.ProductVariants?.BasePrice ?? detail.productVariant?.BasePrice ?? detail.productVariant?.basePrice ?? 0,
          Products: detail.ProductVariants?.Products ?? detail.productVariant?.Products
        }
      }))
    })) as any;
  }

  /**
   * Extract brand, scent, gender, occasion, price preferences from orders
   */
  private extractPreferencesFromOrders(orders: OrderWithProducts[]): {
    topBrands: string[];
    topScents: string[];
    topGenders: string[];
    topOccasions: string[];
    topPriceRanges: string[];
  } {
    const brandCounts = new Map<string, number>();
    const scentCounts = new Map<string, number>();
    const genderCounts = new Map<string, number>();
    const priceRangeCounts = new Map<string, number>();

    orders.forEach((order) => {
      if (!order?.orderDetails) return;
      
      // Time Decay factor for historical orders
      const monthsAgo = differenceInDays(new Date(), order.createdAt) / 30;
      let decay = 1.0;
      if (monthsAgo > 12) decay = 0.4;
      else if (monthsAgo > 3) decay = 0.7;

      order.orderDetails.forEach((detail) => {
        if (!detail?.productVariant?.Products) return;
        
        const product = detail.productVariant.Products;

        if (!product) return;

        // Count brand
        if (product.Brands?.Name) {
          brandCounts.set(
            product.Brands.Name,
            (brandCounts.get(product.Brands.Name) || 0) + (detail.quantity * decay)
          );
        }

        // Count gender
        if (product.Gender) {
          genderCounts.set(
            product.Gender,
            (genderCounts.get(product.Gender) || 0) + (detail.quantity * decay)
          );
        }

        // Count scent notes
        product.ProductNoteMaps?.forEach((noteMap) => {
          if (noteMap.ScentNotes?.Name) {
            scentCounts.set(
              noteMap.ScentNotes.Name,
              (scentCounts.get(noteMap.ScentNotes.Name) || 0) + (detail.quantity * decay)
            );
          }
        });

        // Count price ranges
        const priceRange = this.getPriceRange(detail.unitPrice);
        priceRangeCounts.set(
          priceRange,
          (priceRangeCounts.get(priceRange) || 0) + (detail.quantity * decay)
        );
      });
    });

    return {
      topBrands: this.getTopItems(brandCounts, 3, 'BRANDS'),
      topScents: this.getTopItems(scentCounts, 3, 'SCENTS'),
      topGenders: this.getTopItems(genderCounts, 2, 'GENDERS'),
      topOccasions: [], // From survey data, not orders
      topPriceRanges: this.getTopItems(priceRangeCounts, 2, 'PRICE_RANGES')
    };
  }

  /**
   * Extract preference signals from rolling user log summary.
   * This is the fallback for users without order history but with product clicks/searches.
   */
  private extractPreferencesFromUserSummary(userSummary: any): {
    topBrands: string[];
    topScents: string[];
    topGenders: string[];
    topOccasions: string[];
    topPriceRanges: string[];
    surveyTopScents: string[];
    surveyTopOccasions: string[];
    surveyTopStyles: string[];
  } {
    try {
      const featureSnapshot = userSummary?.featureSnapshot;
      if (!featureSnapshot) {
        return {
          topBrands: [],
          topScents: [],
          topGenders: [],
          topOccasions: [],
          topPriceRanges: [],
          surveyTopScents: [],
          surveyTopOccasions: [],
          surveyTopStyles: []
        };
      }

      const merged = featureSnapshot.merged || {};
      const byEvent = featureSnapshot.byEvent || {};
      const survey = byEvent.survey || {};

      return {
        topBrands: this.getTopItems(new Map(Object.entries(merged.brand || {})), 3, 'SUMMARY_BRANDS'),
        topScents: this.getTopItems(new Map(Object.entries(merged.scent || {})), 3, 'SUMMARY_SCENTS'),
        topGenders: this.getTopItems(new Map(Object.entries(merged.gender || {})), 2, 'SUMMARY_GENDERS'),
        topOccasions: this.getTopItems(new Map(Object.entries(merged.occasion || {})), 3, 'SUMMARY_OCCASIONS'),
        topPriceRanges: this.getTopItems(new Map(Object.entries(merged.priceRange || {})), 2, 'SUMMARY_PRICE_RANGES'),
        surveyTopScents: this.getTopItems(new Map(Object.entries(survey.scent || {})), 3, 'SURVEY_SCENTS'),
        surveyTopOccasions: this.getTopItems(new Map(Object.entries(survey.occasion || {})), 3, 'SURVEY_OCCASIONS'),
        surveyTopStyles: this.getTopItems(new Map(Object.entries(survey.style || {})), 3, 'SURVEY_STYLES')
      };
    } catch (error) {
      this.logger.warn('Failed to extract preferences from user summary', error);
      return {
        topBrands: [],
        topScents: [],
        topGenders: [],
        topOccasions: [],
        topPriceRanges: [],
        surveyTopScents: [],
        surveyTopOccasions: [],
        surveyTopStyles: []
      };
    }
  }

  /**
   * Get top N items from a count map (topK selection)
   * Sorts by frequency descending and takes first N items
   */
  private getTopItems(map: Map<string, number>, n: number, category: string = ''): string[] {
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const selected = sorted.slice(0, n).map((entry) => entry[0]);
    
    // Log the topK selection
    const debug = sorted.map((entry) => `${entry[0]}(${entry[1]})`).join(', ');
    this.logger.log(`[TOPK] ${category} - All: [${debug}] → Top${n}: [${selected.join(', ')}]`);
    
    return selected;
  }

  /**
   * Categorize price into ranges
   */
  private getPriceRange(price: number): string {
    if (price < 500_000) return '< 500k';
    if (price < 1_000_000) return '500k-1m';
    if (price < 2_000_000) return '1m-2m';
    if (price < 3_000_000) return '2m-3m';
    return '> 3m';
  }

  /**
   * Calculate dynamic age from DateOfBirth
   */
  private async calculateDynamicAge(userId: string): Promise<number> {
    const user = await this.prisma.aspNetUsers.findUnique({
      where: { Id: userId },
      include: {
        CustomerProfiles: {
          select: { DateOfBirth: true }
        }
      }
    });

    if (!user?.CustomerProfiles?.DateOfBirth) {
      return 25; // Default age
    }

    const dob = new Date(user.CustomerProfiles.DateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dob.getDate())
    ) {
      age--;
    }

    return Math.max(18, age); // Minimum 18
  }

  /**
   * Calculate monthly budget from order history average
   */
  private calculateMonthlyBudget(
    orders: OrderWithProducts[]
  ): { avg: number; min: number; max: number } {
    if (orders.length === 0) {
      return { avg: 2_000_000, min: 1_000_000, max: 3_000_000 }; // Default
    }

    const last3Months = subMonths(new Date(), 3);
    const recent = orders.filter((o) => isAfter(o.createdAt, last3Months));

    if (recent.length === 0) {
      // Use all orders
      const validTotals = orders
        .map((o) => Number(o.totalAmount))
        .filter((amount) => Number.isFinite(amount));

      if (validTotals.length === 0) {
        return { avg: 2_000_000, min: 1_000_000, max: 3_000_000 };
      }

      const total = validTotals.reduce((sum, amount) => sum + amount, 0);
      const avg = total / validTotals.length;
      return {
        avg,
        min: Math.floor(avg * 0.7),
        max: Math.ceil(avg * 1.3)
      };
    }

    const validRecentTotals = recent
      .map((o) => Number(o.totalAmount))
      .filter((amount) => Number.isFinite(amount));

    if (validRecentTotals.length === 0) {
      return { avg: 2_000_000, min: 1_000_000, max: 3_000_000 };
    }

    const total = validRecentTotals.reduce((sum, amount) => sum + amount, 0);
    const months = Math.min(3, validRecentTotals.length);
    const avg = total / months;

    return {
      avg,
      min: Math.floor(avg * 0.7),
      max: Math.ceil(avg * 1.3)
    };
  }

  /**
   * Detect current season (summer/winter)
   */
  private detectCurrentSeason(): Season {
    const month = new Date().getMonth() + 1; // 1-12
    // Vietnam Climate Adaptation:
    // South VN: mostly hot year-round. North VN: cold in late Nov-Feb.
    // For a general fragrance logic in VN, 'summer' (fresh/citrus) dominates.
    // We treat Nov-Feb as 'winter', March-Oct as 'summer'.
    return month >= 3 && month <= 10 ? 'summer' : 'winter';
  }

  /**
   * Extract scent, occasion, style preferences from survey
   */
  private extractSurveyPreferences(
    userSummary: any
  ): {
    scents: string[];
    occasions: string[];
    styles: string[];
  } {
    try {
      if (!userSummary?.featureSnapshot?.byEvent?.survey) {
        return { scents: [], occasions: [], styles: [] };
      }

      const survey = userSummary.featureSnapshot.byEvent.survey;

      return {
        scents: this.getTopItems(
          new Map(Object.entries(survey.scent || {})),
          3
        ),
        occasions: this.getTopItems(
          new Map(Object.entries(survey.occasion || {})),
          3
        ),
        styles: this.getTopItems(
          new Map(Object.entries(survey.style || {})),
          3
        )
      };
    } catch (error) {
      this.logger.warn('Failed to extract survey preferences', error);
      return { scents: [], occasions: [], styles: [] };
    }
  }

  /**
   * Calculate repurchase frequency for each product
   * Returns map of productId -> estimated days between purchases
   */
  private calculateRepurchaseFrequencies(orders: OrderWithProducts[]): Record<
    string,
    number
  > {
    const productPurchases = new Map<string, Date[]>();

    // Group purchases by product
    orders.forEach((order) => {
      if (!order?.orderDetails) return;

      order.orderDetails.forEach((detail) => {
        if (!detail?.productVariant) return;

        const productKey = `${detail.productVariant.id}`;
        if (!productPurchases.has(productKey)) {
          productPurchases.set(productKey, []);
        }
        productPurchases.get(productKey)!.push(order.createdAt);
      });
    });

    // Calculate average frequency
    const frequencies: Record<string, number> = {};

    productPurchases.forEach((dates, productKey) => {
      if (dates.length < 2) {
        // Not enough data
        frequencies[productKey] = 0;
        return;
      }

      // Sort dates
      dates.sort((a, b) => a.getTime() - b.getTime());

      // Calculate intervals
      let totalDays = 0;
      for (let i = 1; i < dates.length; i++) {
        const diff = dates[i].getTime() - dates[i - 1].getTime();
        totalDays += diff / (1000 * 60 * 60 * 24); // Convert to days
      }

      frequencies[productKey] = Math.round(totalDays / (dates.length - 1));
    });

    return frequencies;
  }

  /**
   * Generate 50-100 candidate products based on brand/scent/gender/price
   */
  async generateCandidateProducts(
    profile: RecommendationProfile
  ): Promise<ProductVariantInfo[]> {
    const candidates = new Set<string>();

    const hasBehaviorSignals =
      profile.topBrands.length > 0 ||
      profile.topScents.length > 0 ||
      profile.topGenders.length > 0;

    if (!hasBehaviorSignals) {
      this.logger.warn(
        `[CANDIDATE-GEN] No behavior signals for user ${profile.userId}. Falling back to generic active products.`
      );
    }

    // Query products by top brand OR top scent OR gender
    const products = await this.prisma.products.findMany({
      where: {
        ...(hasBehaviorSignals
          ? {
              OR: [
                // By brand
                ...(profile.topBrands.length > 0
                  ? [{ Brands: { Name: { in: profile.topBrands } } }]
                  : []),
                // By gender
                ...(profile.topGenders.length > 0
                  ? [{ Gender: { in: profile.topGenders } }]
                  : []),
                // By scent if not enough
                ...(candidates.size < 30 && profile.topScents.length > 0
                  ? [
                      {
                        ProductNoteMaps: {
                          some: { ScentNotes: { Name: { in: profile.topScents } } }
                        }
                      }
                    ]
                  : [])
              ]
            }
          : {})
      },
      include: {
        ProductVariants: {
          where: { Status: 'Active' },
          include: {
            Concentrations: true
          }
        },
        Brands: true
      },
      take: 100
    });

    // Map to variant info
    const variants: ProductVariantInfo[] = [];

    products.forEach((product) => {
      if (!product?.ProductVariants) return;

      product.ProductVariants.forEach((variant) => {
        variants.push({
          variantId: variant.Id,
          productId: product.Id,
          productName: product.Name,
          variantName: `${product.Name} ${variant.VolumeMl}ml`,
          brand: product.Brands?.Name,
          gender: product.Gender,
          basePrice: Number(variant.BasePrice),
          volumeMl: variant.VolumeMl,
          concentration: variant.Concentrations?.Name,
          priceRange: this.getPriceRange(Number(variant.BasePrice))
        });
      });
    });

    return variants.slice(0, 100);
  }

  /**
   * Score a single product against user profile
   */
  scoreProduct(
    product: ProductVariantInfo,
    profile: RecommendationProfile,
    chatContext?: AnalysisObject,
    customWeights?: Partial<ScoresWeights>
  ): ProductScore {
    const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

    const brandScore = this.calculateBrandScore(product, profile);
    const scentScore = this.calculateScentScore(product, profile);
    const surveyScore = this.calculateSurveyScore(product, profile);
    const seasonScore = this.calculateSeasonScore(product, profile);
    const ageScore = this.calculateAgeScore(product, profile);
    const budgetScore = this.calculateBudgetScore(product, profile);

    let score =
      brandScore * weights.brand +
      scentScore * weights.scent +
      surveyScore * weights.survey +
      seasonScore * weights.season +
      ageScore * weights.age +
      budgetScore * weights.budget;

    // Check repurchase candidate & apply bonus
    const { isRepurchaseCandidate, daysRemaining } =
      this.isRepurchaseCandidate(product, profile);
    const repurchaseBonus = isRepurchaseCandidate ? 0.5 : 0;

    let finalScore = score;
    if (isRepurchaseCandidate) {
      finalScore = score * 1.5; // Boost score by 50% for repurchase items
    }

    // Incorporate ChatContext (AnalysisObject) to override or boost scores
    if (chatContext) {
      const logic = chatContext.logic || [];
      const productNames = chatContext.productNames || [];

      // 1. Direct product name mention (Huge boost)
      if (productNames.includes(product.productName)) {
        finalScore += 0.4; // +40% score 
      }

      // 2. Logic matching (CNF parsing)
      if (logic.length > 0) {
        // Flatten the CNF logic for a simple keyword match heuristic for recommendation
        // In a strict search this would be a hard filter, but for recommendation it's a strong signals boost
        // @ts-ignore - TS doesn't know flat() depth typing perfectly here
        const flatTerms: string[] = logic.flat(Infinity);
        const normalizedTerms = flatTerms.map(t => t.toLowerCase());
        
        let matchCount = 0;
        if (product.brand && normalizedTerms.some(t => product.brand!.toLowerCase().includes(t))) matchCount++;
        if (product.gender && normalizedTerms.some(t => product.gender!.toLowerCase() === t)) matchCount++;
        if (product.olfactoryFamilies?.some(f => normalizedTerms.some(t => f.toLowerCase().includes(t)))) matchCount++;
        
        if (matchCount > 0) {
          finalScore += (matchCount * 0.15); // Add 15% per matched attribute from chat context
        }
      }
    }

    const normalizedScore = Math.min(100, Math.max(0, finalScore * 100)); // Normalize to 0-100
    
    // Log detailed scoring breakdown
    this.logger.debug(
      `[SCORE] ${product.productName}: ` +
      `Brand(${(brandScore * weights.brand * 100).toFixed(1)}%) + ` +
      `Scent(${(scentScore * weights.scent * 100).toFixed(1)}%) + ` +
      `Survey(${(surveyScore * weights.survey * 100).toFixed(1)}%) + ` +
      `Season(${(seasonScore * weights.season * 100).toFixed(1)}%) + ` +
      `Age(${(ageScore * weights.age * 100).toFixed(1)}%) + ` +
      `Budget(${(budgetScore * weights.budget * 100).toFixed(1)}%) ` +
      `${isRepurchaseCandidate ? `+ Repurchase(×1.5) ` : ''}` +
      `= ${normalizedScore.toFixed(1)}/100`
    );

    return {
      productId: product.productId,
      variantId: product.variantId,
      productName: product.productName,
      variantName: product.variantName || product.productName,
      brand: product.brand,
      basePrice: product.basePrice,
      gender: product.gender,
      olfactoryFamilies: product.olfactoryFamilies,
      score: normalizedScore,
      scoreBreakdown: {
        brandScore: brandScore * 100,
        scentScore: scentScore * 100,
        surveyScore: surveyScore * 100,
        seasonScore: seasonScore * 100,
        ageScore: ageScore * 100,
        budgetScore: budgetScore * 100,
        repurchaseBonus
      },
      isRepurchaseCandidate,
      repurchaseDaysRemaining: daysRemaining
    };
  }

  /**
   * Calculate brand score (0-1)
   * Higher if product brand is in user's top brands
   */
  private calculateBrandScore(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): number {
    if (!product.brand || profile.topBrands.length === 0) return 0.3; // Default low score

    const normalizedProductBrand = product.brand.toLowerCase().trim();
    if (profile.topBrands.some(b => b.toLowerCase().trim() === normalizedProductBrand)) {
      return 1.0;
    }

    return 0.4; // Slightly above default for unmatched brands
  }

  /**
   * Calculate scent score (0-1)
   * Based on overlapping scent notes with top scents
   */
  private calculateScentScore(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): number {
    if (!product.scentNotes || product.scentNotes.length === 0) return 0.3;
    if (profile.topScents.length === 0) return 0.5;

    const normalizedTopScents = profile.topScents.map(s => s.toLowerCase().trim().normalize('NFC'));
    
    const matches = product.scentNotes.filter((note) => {
      const normalizedNote = note.toLowerCase().trim().normalize('NFC');
      return normalizedTopScents.some(
        (topScent) =>
          topScent === normalizedNote ||
          normalizedNote.includes(topScent)
      );
    }).length;

    return Math.min(1.0, Math.max(0.3, 0.3 + (matches / product.scentNotes.length) * 0.7));
  }

  /**
   * Calculate survey score (0-1)
   * Based on survey scent/occasion/style preferences
   */
  private calculateSurveyScore(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): number {
    let score = 0.2; // Base score

    // Scent match
    if (
      product.scentNotes &&
      profile.surveyTopScents.length > 0
    ) {
      const scentMatch = product.scentNotes.some((note) => {
        const normalizedNote = note.toLowerCase().trim().normalize('NFC');
        return profile.surveyTopScents.some(
          (surveyScent) =>
            surveyScent.toLowerCase().trim().normalize('NFC') === normalizedNote
        );
      });
      if (scentMatch) score += 0.5;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate season score (0-1)
   * Higher for seasonal matches
   */
  private calculateSeasonScore(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): number {
    // For now, simple logic: fresh scents in summer, warm in winter
    if (profile.currentSeason === 'summer') {
      const freshKeywords = ['citrus', 'aqua', 'fresh', 'ocean', 'light'];
      const isFresh =
        product.scentNotes?.some((note) =>
          freshKeywords.some((keyword) =>
            note.toLowerCase().includes(keyword.toLowerCase())
          )
        ) || false;

      return isFresh ? 1.0 : 0.4;
    } else {
      // Winter
      const warmKeywords = ['warm', 'spice', 'vanilla', 'woody', 'amber'];
      const isWarm =
        product.scentNotes?.some((note) =>
          warmKeywords.some((keyword) =>
            note.toLowerCase().includes(keyword.toLowerCase())
          )
        ) || false;

      return isWarm ? 1.0 : 0.4;
    }
  }

  /**
   * Calculate age score (0-1)
   * Simple range check
   */
  private calculateAgeScore(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): number {
    // For now, simple logic: any age gets decent score
    if (profile.dynamicAge < 25) {
      // Young
      const youngKeywords = ['fresh', 'playful', 'sporty', 'light'];
      const isYoung =
        product.scentNotes?.some((note) =>
          youngKeywords.some((keyword) =>
            note.toLowerCase().includes(keyword.toLowerCase())
          )
        ) || false;

      return isYoung ? 0.9 : 0.6;
    } else if (profile.dynamicAge > 30) {
      // Mature
      const matureKeywords = ['warm', 'elegant', 'sophisticated', 'amber'];
      const isMature =
        product.scentNotes?.some((note) =>
          matureKeywords.some((keyword) =>
            note.toLowerCase().includes(keyword.toLowerCase())
          )
        ) || false;

      return isMature ? 0.9 : 0.6;
    }

    return 0.7; // Mid-range age
  }

  /**
   * Calculate budget score (0-1)
   */
  private calculateBudgetScore(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): number {
    if (!product.basePrice) return 0.5;

    const price = product.basePrice;
    const maxBudget = profile.maxBudgetMonthly;

    if (!Number.isFinite(maxBudget) || maxBudget <= 0) {
      return 0.5;
    }

    if (price <= maxBudget) {
      return 1.0; // Within budget
    }

    if (price <= maxBudget * 1.5) {
      return 0.5; // Slightly over budget
    }

    return 0.1; // Way over budget
  }

  /**
   * Check if product is a repurchase candidate
   * Based on repurchase frequency from order history
   */
  private isRepurchaseCandidate(
    product: ProductVariantInfo,
    profile: RecommendationProfile
  ): { isRepurchaseCandidate: boolean; daysRemaining?: number } {
    const frequency = profile.repurchaseFrequencyMap[product.variantId];

    if (!frequency || frequency === 0) {
      return { isRepurchaseCandidate: false };
    }

    // Suggest repurchase if user typically buys this product
    // (actual logic would track last purchase date, but we'll keep it simple)
    return { isRepurchaseCandidate: true, daysRemaining: frequency };
  }

  /**
   * Fallback: Get best seller products
   */
  private async getBestSellersFallback(limit: number, chatContext?: AnalysisObject): Promise<ProductScore[]> {
    const products = await this.prisma.products.findMany({
      include: {
        ProductVariants: {
          where: { Status: 'Active' },
          take: 1,
          orderBy: { BasePrice: 'desc' }
        },
        Brands: true
      },
      orderBy: { Id: 'desc' },
      take: limit
    });

    return products
      .filter((p) => p.ProductVariants.length > 0)
      .map((p) => ({
        productId: p.Id,
        variantId: p.ProductVariants[0].Id,
        productName: p.Name,
        variantName: `${p.Name} ${p.ProductVariants[0].VolumeMl}ml`,
        brand: p.Brands?.Name,
        basePrice: Number(p.ProductVariants[0].BasePrice),
        gender: p.Gender,
        score: 50, // Neutral score
        scoreBreakdown: {
          brandScore: 0,
          scentScore: 0,
          surveyScore: 0,
          seasonScore: 0,
          ageScore: 0,
          budgetScore: 0,
          repurchaseBonus: 0
        },
        isRepurchaseCandidate: false
      }))
      .slice(0, limit);
  }

  private deduplicateProductScores(scores: ProductScore[]): ProductScore[] {
    const byProductId = new Map<string, ProductScore>();

    for (const score of scores) {
      const existing = byProductId.get(score.productId);
      if (!existing || score.score > existing.score) {
        byProductId.set(score.productId, score);
      }
    }

    return Array.from(byProductId.values());
  }
}
