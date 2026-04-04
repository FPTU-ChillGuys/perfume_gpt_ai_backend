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
import { isAfter, isWithinInterval, subMonths, subYears } from 'date-fns';

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
    userId: string,
    topN: number = 10,
    weights?: Partial<ScoresWeights>
  ): Promise<BaseResponse<RecommendationResponse>> {
    try {
      // Step 1: Build user profile
      const profile = await this.buildUserRecommendationProfile(userId);

      // Step 2: Generate candidate products
      const candidates = await this.generateCandidateProducts(profile);

      if (candidates.length === 0) {
        // Fallback: return best sellers
        return {
          success: true,
          data: {
            userId,
            recommendations: await this.getBestSellersFallback(topN),
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
        this.scoreProduct(product, profile, weights)
      );

      // Step 4: Apply budget filter
      const budgetFiltered = scoredProducts.filter(
        (p) => p.basePrice && p.basePrice <= profile.maxBudgetMonthly * 1.2
      );

      // Sort by score
      const sorted = budgetFiltered.sort((a, b) => b.score - a.score);

      // Fallback if not enough after filters
      const final =
        sorted.length < topN
          ? [
              ...sorted,
              ...(await this.getBestSellersFallback(topN - sorted.length))
            ].slice(0, topN)
          : sorted.slice(0, topN);

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
      this.logger.error(`Failed to get recommendations for user ${userId}:`, error);
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
    userId: string
  ): Promise<RecommendationProfile> {
    const [user, orders, userSummary] = await Promise.all([
      this.userService.getUserById(userId).catch(() => null),
      this.getOrdersForUser(userId),
      this.userLogService
        .getUserLogSummaryByUserId(userId)
        .catch(() => ({ success: false, data: null }))
    ]);

    // Extract preferences from orders
    const preferences = this.extractPreferencesFromOrders(orders);

    // Calculate dynamic age
    const dynamicAge = await this.calculateDynamicAge(userId);

    // Calculate budget from order history
    const budgetInfo = this.calculateMonthlyBudget(orders);

    // Detect current season
    const currentSeason = this.detectCurrentSeason();

    // Extract survey preferences
    const surveyPrefs = this.extractSurveyPreferences(
      userSummary?.success ? (userSummary.data as any) : null
    );

    // Calculate repurchase frequency
    const repurchaseMap = this.calculateRepurchaseFrequencies(orders);

    return {
      userId,
      dynamicAge,
      gender: preferences.topGenders[0],
      topBrands: preferences.topBrands,
      topScents: preferences.topScents,
      topGenders: preferences.topGenders,
      topOccasions: preferences.topOccasions,
      topPriceRanges: preferences.topPriceRanges,
      monthlyBudgetAvg: budgetInfo.avg,
      minBudgetMonthly: budgetInfo.min,
      maxBudgetMonthly: budgetInfo.max,
      currentSeason,
      surveyTopScents: surveyPrefs.scents,
      surveyTopOccasions: surveyPrefs.occasions,
      surveyTopStyles: surveyPrefs.styles,
      repurchaseFrequencyMap: repurchaseMap
    };
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

    return orders as any;
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
      order.orderDetails.forEach((detail) => {
        const product = detail.productVariant.Products;

        if (!product) return;

        // Count brand
        if (product.Brands?.Name) {
          brandCounts.set(
            product.Brands.Name,
            (brandCounts.get(product.Brands.Name) || 0) + detail.quantity
          );
        }

        // Count gender
        if (product.Gender) {
          genderCounts.set(
            product.Gender,
            (genderCounts.get(product.Gender) || 0) + detail.quantity
          );
        }

        // Count scent notes
        product.ProductNoteMaps?.forEach((noteMap) => {
          if (noteMap.ScentNotes?.Name) {
            scentCounts.set(
              noteMap.ScentNotes.Name,
              (scentCounts.get(noteMap.ScentNotes.Name) || 0) + detail.quantity
            );
          }
        });

        // Count price ranges
        const priceRange = this.getPriceRange(detail.unitPrice);
        priceRangeCounts.set(
          priceRange,
          (priceRangeCounts.get(priceRange) || 0) + detail.quantity
        );
      });
    });

    return {
      topBrands: this.getTopItems(brandCounts, 3),
      topScents: this.getTopItems(scentCounts, 3),
      topGenders: this.getTopItems(genderCounts, 2),
      topOccasions: [], // From survey data, not orders
      topPriceRanges: this.getTopItems(priceRangeCounts, 2)
    };
  }

  /**
   * Get top N items from a count map
   */
  private getTopItems(map: Map<string, number>, n: number): string[] {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map((entry) => entry[0]);
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
      const total = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const avg = total / orders.length;
      return {
        avg,
        min: Math.floor(avg * 0.7),
        max: Math.ceil(avg * 1.3)
      };
    }

    const total = recent.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const months = Math.min(3, recent.length);
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
    // Summer: May-August (5-8)
    return month >= 5 && month <= 8 ? 'summer' : 'winter';
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
      order.orderDetails.forEach((detail) => {
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

    // Query products by top brand OR top scent OR gender
    const products = await this.prisma.products.findMany({
      where: {
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

    if (isRepurchaseCandidate) {
      score *= 1.5; // Boost score by 50% for repurchase items
    }

    return {
      productId: product.productId,
      variantId: product.variantId,
      productName: product.productName,
      variantName: product.variantName || product.productName,
      brand: product.brand,
      basePrice: product.basePrice,
      gender: product.gender,
      score: Math.min(100, Math.max(0, score * 100)), // Normalize to 0-100
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

    if (profile.topBrands.includes(product.brand)) {
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

    const matches = product.scentNotes.filter((note) =>
      profile.topScents.some(
        (topScent) =>
          topScent.toLowerCase() === note.toLowerCase() ||
          note.toLowerCase().includes(topScent.toLowerCase())
      )
    ).length;

    return Math.min(1.0, 0.3 + (matches / product.scentNotes.length) * 0.7);
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
      const scentMatch = product.scentNotes.some((note) =>
        profile.surveyTopScents.some(
          (surveyScent) =>
            surveyScent.toLowerCase() === note.toLowerCase()
        )
      );
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
  private async getBestSellersFallback(limit: number): Promise<ProductScore[]> {
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
}
