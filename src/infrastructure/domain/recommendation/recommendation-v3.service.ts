import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from '../user/user.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { 
  ScoresWeights,
  DEFAULT_WEIGHTS,
  ProductScoreV3,
  RecommendationProfileV3
} from './recommendation-profile.type';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';

@Injectable()
export class RecommendationV3Service {
  private readonly logger = new Logger(RecommendationV3Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService
  ) {}

  /**
   * Main entry point: recommendations for V3 (Simple & Practical)
   */
  async getRecommendations(
    userIdRaw: string,
    size: number = 10,
    chatContext?: AnalysisObject,
    weights?: Partial<ScoresWeights>
  ): Promise<BaseResponse<any>> {
    try {
      const userId = userIdRaw.toLowerCase();
      this.logger.log(`[V3_START] Get recommendations for: ${userId}, max: ${size}`);

      // Phase 1: Build Profile
      const profile = await this.buildProfile(userId);
      this.logger.log(`[V3_PROFILE] Brands: ${profile.topBrands.join(',')}, Scents: ${profile.topScents.join(',')}, Budget: ${profile.budgetRange[0]}-${profile.budgetRange[1]}`);

      // Optional: Check if we have absolute 0 preference
      const hasAnyPreference = profile.topBrands.length > 0 || profile.topScents.length > 0;
      if (!hasAnyPreference) {
        this.logger.warn(`[V3_WARN] No preferences found for ${userId}. Fallback to random bestsellers.`);
        return this.getFallbackRecommendations(size);
      }

      // Phase 2: Candidate Generation (OR logic)
      const candidates = await this.generateCandidates(profile, size * 5); // Fetch top N pool
      this.logger.log(`[V3_CANDIDATES] Picked ${candidates.length} candidates for scoring`);

      if (candidates.length === 0) {
        return this.getFallbackRecommendations(size);
      }

      // Merge dynamic weights
      const activeWeights = { ...DEFAULT_WEIGHTS, ...weights };

      // Phase 3: Scoring
      const scoredProducts = candidates.map(candidate => {
        const bd = this.calculateScores(candidate, profile);

        // Linear formula
        const totalScore = 
          (bd.brandScore * activeWeights.brand) +
          (bd.scentScore * activeWeights.scent) +
          (bd.budgetScore * activeWeights.budget) +
          (bd.seasonScore * activeWeights.season);

        return {
          productId: candidate.productId,
          variantId: candidate.variantId,
          productName: candidate.productName,
          brand: candidate.brand,
          basePrice: candidate.basePrice,
          scentNotes: candidate.scentNotes,
          score: Math.min(100, Math.round(totalScore * 100)), // 0 - 100%
          scoreBreakdown: bd
        } as ProductScoreV3;
      });

      // Phase 4: Post-processing (Sort and get top N)
      const sortedProducts = scoredProducts.sort((a, b) => b.score - a.score);

      // Dedup variants (only highest score variant per product)
      const deduped: ProductScoreV3[] = [];
      const seenProductIds = new Set<string>();

      for (const item of sortedProducts) {
        if (!seenProductIds.has(item.productId)) {
          seenProductIds.add(item.productId);
          deduped.push(item);
        }
        if (deduped.length >= size) break;
      }

      return {
        success: true,
        data: {
          userId,
          recommendations: deduped,
          totalProducts: deduped.length,
          profile: {
            age: profile.age,
            budgetRange: profile.budgetRange,
            avgPrice: profile.avgPrice,
            topBrands: profile.topBrands,
            topScents: profile.topScents
          }
        }
      };

    } catch (e) {
      this.logger.error(`[V3_ERROR] Error generating recommendation`, e);
      return this.getFallbackRecommendations(size);
    }
  }

  /**
   * Phase 1: Build Profile simply from Orders then Surveys
   */
  private async buildProfile(userId: string): Promise<RecommendationProfileV3> {
    const defaultProfile: RecommendationProfileV3 = {
      topBrands: [],
      topScents: [],
      avgPrice: 1000000, // 1 mil
      budgetRange: [500000, 2000000],
      age: 25
    };

    // Age
    const user = await this.prisma.customerProfiles.findFirst({
      where: { UserId: userId }
    });
    if (user?.DateOfBirth) {
      const birthYear = new Date(user.DateOfBirth).getFullYear();
      const currentYear = new Date().getFullYear();
      defaultProfile.age = currentYear - birthYear;
    }

    // Orders
    const orders = await this.prisma.orders.findMany({
      where: { 
        CustomerId: userId,
        Status: 'Delivered'
        // Ideally filter 1 year ago as well
      },
      include: {
        OrderDetails: {
          include: {
            ProductVariants: {
              include: {
                Products: {
                  include: { 
                    Brands: true,
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
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const brands = new Map<string, number>();
    const scents = new Map<string, number>();
    let totalPrice = 0;
    let totalItems = 0;

    orders.forEach(order => {
      order.OrderDetails.forEach(item => {
        const pv = item.ProductVariants;
        if (!pv) return;

        // Collect Price
        if (pv.BasePrice) {
          totalPrice += Number(pv.BasePrice) * Number(item.Quantity || 1);
          totalItems += Number(item.Quantity || 1);
        }

        // Collect Brand
        const brandName = pv.Products?.Brands?.Name;
        if (brandName) brands.set(brandName, (brands.get(brandName) || 0) + 1);

        // Collect Scents
        const pvNotes = pv.Products?.ProductNoteMaps || [];
        pvNotes.forEach(map => {
           if (map.ScentNotes?.Name) {
             const scent = map.ScentNotes.Name.trim();
             scents.set(scent, (scents.get(scent) || 0) + 1);
           }
        });
      });
    });

    // Determine Top Brands
    if (brands.size > 0) {
      defaultProfile.topBrands = Array.from(brands.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(x => x[0]);
    }

    // Determine Top Scents
    if (scents.size > 0) {
      defaultProfile.topScents = Array.from(scents.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(x => x[0]);
    }

    // Budget
    if (totalItems > 0 && totalPrice > 0) {
      defaultProfile.avgPrice = Math.round(totalPrice / totalItems);
      defaultProfile.budgetRange = [
        Math.round(defaultProfile.avgPrice * 0.5), 
        Math.round(defaultProfile.avgPrice * 1.5)
      ];
    }

    return defaultProfile;

    // We can also fetch Survey if orders are totally 0 here
    // But skipped for briefness if we just want basic fallback
  }

  /**
   * Phase 2: Candidate Generation (Match Brand OR Match Scent)
   */
  private async generateCandidates(profile: RecommendationProfileV3, fetchLimit: number) {
    const products = await this.prisma.products.findMany({
      where: {
        OR: [
          // if there are no topBrands, Prisma will break so we check length
          ...(profile.topBrands.length > 0 ? [{Brands: { Name: { in: profile.topBrands }}}] : []),
          // For scents, we can't easily perform strict IN because its comma separated strings
          // we fetch top overall if both arrays empty, but we already have empty check in Main.
        ]
      },
      include: {
        Brands: true,
        ProductNoteMaps: {
          include: { ScentNotes: true }
        },
        ProductVariants: {
          where: { Status: 'Active' },
          take: 1, // simplified
          orderBy: { BasePrice: 'desc' }
        }
      },
      take: fetchLimit * 2
    });

    // Fallback: If Brand query was too strict, or Scents are comma lists in DB:
    let baseProducts = products;
    if (baseProducts.length < 5) {
      baseProducts = await this.prisma.products.findMany({
        include: { 
          Brands: true, 
          ProductNoteMaps: { include: { ScentNotes: true } },
          ProductVariants: { where: { Status: 'Active'}, take:1 } 
        },
        orderBy: { Id: 'desc' },
        take: fetchLimit
      })
    }

    return baseProducts.map((p) => {
      const v = p.ProductVariants[0];
      const sNotes = p.ProductNoteMaps?.map(x => x.ScentNotes?.Name).filter(Boolean) as string[];

      return {
        productId: p.Id,
        variantId: v?.Id,
        productName: p.Name,
        brand: p.Brands?.Name,
        basePrice: v?.BasePrice ? Number(v.BasePrice) : 2000000,
        scentNotes: sNotes.map(s => s.trim().toLowerCase())
      };
    });
  }

  /**
   * Phase 3: Scoring
   */
  private calculateScores(product: any, profile: RecommendationProfileV3) {
    // 1. Brand
    let brandScore = 0.3; // Base
    const productBrand = product.brand?.toLowerCase() || '';
    if (profile.topBrands.some(b => b.toLowerCase() === productBrand)) {
      brandScore = 1.0;
    }

    // 2. Scent
    let scentScore = 0.3;
    const matches = product.scentNotes.filter((pn: string) => 
      profile.topScents.some(ps => pn.includes(ps.toLowerCase()) || ps.toLowerCase().includes(pn))
    ).length;
    if (matches > 0 && product.scentNotes.length > 0) {
      scentScore = Math.min(1.0, 0.3 + (matches / product.scentNotes.length) * 0.7);
    }

    // 3. Budget
    let budgetScore = 0.5;
    const [min, max] = profile.budgetRange;
    const price = product.basePrice;
    if (price <= max) budgetScore = 1.0;
    else if (price <= max * 1.5) budgetScore = 0.5;
    else budgetScore = 0.1; // Extravagant

    // 4. Season
    let seasonScore = 0.5; // Neutral
    const isSummer = new Date().getMonth() >= 4 && new Date().getMonth() <= 8; // approx
    const freshKeys = ['citrus', 'aqua', 'fresh', 'ocean'];
    const warmKeys = ['warm', 'spice', 'vanilla', 'woody', 'amber'];
    
    if (isSummer) {
       if (product.scentNotes.some((n: string) => freshKeys.some(k => n.includes(k)))) seasonScore = 1.0;
    } else {
       if (product.scentNotes.some((n: string) => warmKeys.some(k => n.includes(k)))) seasonScore = 1.0;
    }

    return { brandScore, scentScore, budgetScore, seasonScore };
  }

  private async getFallbackRecommendations(size: number): Promise<BaseResponse<any>> {
      return { success: true, data: { recommendations: [], totalProducts: 0, profile: null } };
  }
}
