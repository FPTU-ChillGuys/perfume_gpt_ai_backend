import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { tool, Tool } from 'ai';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';
import { PrismaService } from 'src/prisma/prisma.service';

type RecommendationContextSource = 'order' | 'profile' | 'none';

type RecommendationBudgetHint = {
  min: number | null;
  max: number | null;
};

type ToonContextPayload = {
  source: 'order' | 'profile';
  encoded: string;
  originalSize: number;
  encodedSize: number;
  compressionRatio: number;
};

@Injectable()
export class ProfileTool {
  private readonly logger = new Logger(ProfileTool.name);

  private profileService?: ProfileService;
  private orderService?: OrderService;
  private prismaService?: PrismaService;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly err: I18nErrorHandler
  ) {}

  private getPrismaService(): PrismaService {
    if (!this.prismaService) {
      this.prismaService = this.moduleRef.get(PrismaService, { strict: false });
    }
    if (!this.prismaService) throw new Error('PrismaService is not available');
    return this.prismaService;
  }

  private getProfileService(): ProfileService {
    if (!this.profileService) {
      this.profileService = this.moduleRef.get(ProfileService, {
        strict: false
      });
    }

    if (!this.profileService) {
      throw new Error('ProfileService is not available');
    }

    return this.profileService;
  }

  private getOrderService(): OrderService {
    if (!this.orderService) {
      this.orderService = this.moduleRef.get(OrderService, { strict: false });
    }

    if (!this.orderService) {
      throw new Error('OrderService is not available');
    }

    return this.orderService;
  }

  private splitTerms(input?: string | null): string[] {
    if (!input) {
      return [];
    }

    return input
      .split(/[;,/|\n]/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 50);
  }

  private uniqueKeywords(items: string[]): string[] {
    return Array.from(
      new Set(items.map((item) => item.trim()).filter(Boolean))
    ).slice(0, 16);
  }

  private calculateDynamicAge(dateOfBirth?: string | null): number | null {
    if (!dateOfBirth) {
      return null;
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return null;
    }

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const dayDiff = now.getDate() - dob.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

  private deriveBudgetHint(
    orders: OrderResponse[],
    profile?: ProfileResponse | null
  ): RecommendationBudgetHint | null {
    const profileMin =
      profile?.minBudget != null ? Number(profile.minBudget) : null;
    const profileMax =
      profile?.maxBudget != null ? Number(profile.maxBudget) : null;

    if (profileMin != null || profileMax != null) {
      return {
        min: profileMin,
        max: profileMax
      };
    }

    if (!orders.length) {
      return null;
    }

    const now = Date.now();
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
    const recentOrders = orders.filter((order) => {
      const time = new Date(order.createdAt).getTime();
      return Number.isFinite(time) && time >= threeMonthsAgo;
    });

    const source = recentOrders.length > 0 ? recentOrders : orders;
    const amounts = source
      .map((order) => Number(order.totalAmount))
      .filter((amount) => Number.isFinite(amount));

    if (!amounts.length) {
      return null;
    }

    const avg =
      amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

    return {
      min: Math.round(avg * 0.7),
      max: Math.round(avg * 1.3)
    };
  }

  private extractTopOrderProducts(orders: OrderResponse[]): string[] {
    const productCounter = new Map<string, number>();

    for (const order of orders) {
      for (const detail of order.orderDetails || []) {
        const variantName = detail.variantName || 'Unknown Variant';
        productCounter.set(
          variantName,
          (productCounter.get(variantName) || 0) + detail.quantity
        );
      }
    }

    return Array.from(productCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }

  private extractProfileKeywords(profile?: ProfileResponse | null): string[] {
    if (!profile) {
      return [];
    }

    return this.uniqueKeywords([
      ...this.splitTerms(profile.favoriteNotes),
      ...this.splitTerms(profile.scentPreference),
      ...this.splitTerms(profile.preferredStyle)
    ]);
  }

  private buildOrderContextPayload(
    orders: OrderResponse[],
    attributeAggregates?: Record<string, any>
  ): Record<string, any> {
    const normalizedOrders = [...orders]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime() || 0;
        const bTime = new Date(b.createdAt).getTime() || 0;
        return bTime - aTime;
      })
      .map((order) => ({
        orderCode: order.code || null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        type: order.type,
        orderDetails: (order.orderDetails || []).map((detail) => ({
          variantName: detail.variantName,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          total: detail.total
        }))
      }));

    const totalSpent = normalizedOrders.reduce(
      (sum, order) => sum + (Number(order.totalAmount) || 0),
      0
    );

    return {
      orderCount: normalizedOrders.length,
      totalSpent,
      latestOrderAt: normalizedOrders[0]?.createdAt || null,
      orders: normalizedOrders,
      ...(attributeAggregates ? { attributeAggregates } : {})
    };
  }

  private async extractOrderAttributes(
    orders: OrderResponse[]
  ): Promise<Record<string, any>> {
    const variantQuantities = new Map<string, number>();

    for (const order of orders) {
      for (const item of order.orderDetails || []) {
        if (!item.variantId) continue;
        variantQuantities.set(
          item.variantId,
          (variantQuantities.get(item.variantId) || 0) + item.quantity
        );
      }
    }

    if (variantQuantities.size === 0) return {};

    try {
      const prisma = this.getPrismaService();
      const variantIds = Array.from(variantQuantities.keys());
      const variants = await prisma.productVariants.findMany({
        where: { Id: { in: variantIds } },
        include: {
          Concentrations: true,
          Products: {
            include: {
              Brands: true,
              ProductNoteMaps: { include: { ScentNotes: true } },
              ProductFamilyMaps: { include: { OlfactoryFamilies: true } },
              ProductAttributes: { include: { AttributeValues: true } }
            }
          }
        }
      });

      const counters = {
        brands: new Map<string, number>(),
        genders: new Map<string, number>(),
        origins: new Map<string, number>(),
        concentrations: new Map<string, number>(),
        scentNotes: new Map<string, number>(),
        olfactoryFamilies: new Map<string, number>(),
        attributes: new Map<string, number>()
      };

      const addCount = (
        map: Map<string, number>,
        key: string | null | undefined,
        weight: number
      ) => {
        if (!key) return;
        const normalized = key.trim();
        if (normalized)
          map.set(normalized, (map.get(normalized) || 0) + weight);
      };

      for (const v of variants) {
        const qty = variantQuantities.get(v.Id) || 1;
        const p = v.Products;
        if (!p) continue;

        addCount(counters.brands, p.Brands?.Name, qty);
        addCount(counters.genders, p.Gender, qty);
        addCount(counters.origins, p.Origin, qty);
        addCount(counters.concentrations, v.Concentrations?.Name, qty);

        for (const nm of p.ProductNoteMaps || [])
          addCount(counters.scentNotes, nm.ScentNotes?.Name, qty);
        for (const fm of p.ProductFamilyMaps || [])
          addCount(counters.olfactoryFamilies, fm.OlfactoryFamilies?.Name, qty);
        for (const attr of p.ProductAttributes || [])
          addCount(counters.attributes, attr.AttributeValues?.Value, qty);
      }

      const getTop = (map: Map<string, number>, limit: number) =>
        Array.from(map.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([name, count]) => ({ name, count }));

      return {
        brands: getTop(counters.brands, 5),
        genders: getTop(counters.genders, 3),
        origins: getTop(counters.origins, 3),
        concentrations: getTop(counters.concentrations, 3),
        scentNotes: getTop(counters.scentNotes, 6),
        olfactoryFamilies: getTop(counters.olfactoryFamilies, 6),
        attributes: getTop(counters.attributes, 6)
      };
    } catch (e) {
      this.logger.warn(
        `Failed to extract order attributes: ${e instanceof Error ? e.message : String(e)}`
      );
      return {};
    }
  }

  private buildProfileContextPayload(
    profile?: ProfileResponse | null
  ): Record<string, any> {
    return {
      hasProfile: !!profile,
      profileId: profile?.id || null,
      userId: profile?.userId || null,
      dateOfBirth: profile?.dateOfBirth || null,
      dynamicAge: this.calculateDynamicAge(profile?.dateOfBirth),
      favoriteNotes: profile?.favoriteNotes || null,
      scentPreference: profile?.scentPreference || null,
      preferredStyle: profile?.preferredStyle || null,
      minBudget: profile?.minBudget ?? null,
      maxBudget: profile?.maxBudget ?? null,
      updatedAt: profile?.updatedAt || null
    };
  }

  private encodeToonContext(
    source: 'order' | 'profile',
    payload: Record<string, any>
  ): ToonContextPayload {
    const encoded = encodeToolOutput(payload);

    this.logger.debug(
      `[getProfileRecommendationContext] ${source} TOON: ${encoded.encodedSize}/${encoded.originalSize} (${encoded.compressionRatio}%)`
    );

    return {
      source,
      encoded: encoded.encoded,
      originalSize: encoded.originalSize,
      encodedSize: encoded.encodedSize,
      compressionRatio: encoded.compressionRatio
    };
  }

  public async getProfileRecommendationContextPayload(
    userId: string,
    requestedComponents?: ('order' | 'profile')[]
  ): Promise<Record<string, any>> {
    const orderService = this.getOrderService();
    const profileService = this.getProfileService();

    const [ordersResult, profileResult] = await Promise.all([
      orderService
        .getOrderDetailsWithOrdersByUserId(userId)
        .catch(() => ({ success: false }) as any),
      profileService
        .getOwnProfile(userId)
        .catch(() => ({ success: false }) as any)
    ]);

    const orders: OrderResponse[] =
      ordersResult?.success && Array.isArray(ordersResult.data)
        ? ordersResult.data.filter(
            (order) => !['Canceled', 'Returned'].includes(order.orderStatus)
          )
        : [];

    const profile = profileResult?.success ? profileResult.payload : null;

    const profileKeywords = this.extractProfileKeywords(profile);
    const topOrderProducts = this.extractTopOrderProducts(orders);
    const budgetHint = this.deriveBudgetHint(orders, profile);
    const dynamicAge = this.calculateDynamicAge(profile?.dateOfBirth);

    const orderAggregates = await this.extractOrderAttributes(orders);

    const orderContext = this.buildOrderContextPayload(orders, orderAggregates);
    const profileContext = this.buildProfileContextPayload(profile);

    const orderDataToon = this.encodeToonContext('order', orderContext);
    const profileDataToon = this.encodeToonContext('profile', profileContext);

    // Determine which components to include based on request or priority
    let selectedComponentsData: Record<string, any> = {};
    let source: RecommendationContextSource = 'none';

    if (requestedComponents && requestedComponents.length > 0) {
      // User explicitly requested specific components
      if (requestedComponents.includes('order')) {
        selectedComponentsData.orderDataToon = orderDataToon;
        if (orders.length > 0) source = 'order';
      }
      if (requestedComponents.includes('profile')) {
        selectedComponentsData.profileDataToon = profileDataToon;
        if (source === 'none' && (profileKeywords.length > 0 || budgetHint))
          source = 'profile';
      }
    } else {
      // Auto fallback priority: order > profile
      if (orders.length > 0) {
        source = 'order';
        selectedComponentsData.orderDataToon = orderDataToon;
      } else if (profileKeywords.length > 0 || budgetHint) {
        source = 'profile';
        selectedComponentsData.profileDataToon = profileDataToon;
      }
    }

    // Enrich profileKeywords with order-derived insights if available
    if (orders.length > 0 && Object.keys(orderAggregates).length > 0) {
      const orderInsights = [
        ...(orderAggregates.scentNotes || []).map((i: any) => i.name),
        ...(orderAggregates.olfactoryFamilies || []).map((i: any) => i.name)
      ];
      profileKeywords.push(...orderInsights);
    }

    const augmentedKeywords =
      source === 'order'
        ? this.uniqueKeywords(profileKeywords)
        : source === 'profile'
          ? this.uniqueKeywords(profileKeywords)
          : [];

    return {
      source,
      sourcePriority: ['INPUT', 'ORDER', 'PROFILE'],
      requestedComponents: requestedComponents || ['auto'],
      userType: source === 'none' ? 'guest_or_new' : 'returning_user',
      shouldAskProfileUpdate: source === 'none',
      shouldUseBestSellerFallback: source === 'none',
      dynamicAge,
      budgetHint,
      topOrderProducts,
      toonContext: selectedComponentsData,
      contextSummaries: {
        order: {
          orderCount: orderContext.orderCount,
          totalSpent: orderContext.totalSpent,
          latestOrderAt: orderContext.latestOrderAt
        },
        profile: {
          hasProfile: profileContext.hasProfile,
          dynamicAge: profileContext.dynamicAge,
          budgetRange: {
            min: profileContext.minBudget,
            max: profileContext.maxBudget
          }
        }
      },
      profileKeywords,
      augmentedKeywords,
      signals: {
        orderCount: orders.length,
        hasProfile: profileKeywords.length > 0 || !!budgetHint
      }
    };
  }

  getOwnProfile: Tool = tool({
    description:
      'Retrieve user profile fields used for personalization and query augmentation: favoriteNotes, scentPreference, preferredStyle, minBudget, maxBudget, dateOfBirth.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user')
    }),
    execute: async (input) => {
      this.logger.log(`[getOwnProfile] called for userId: ${input.userId}`);
      return await this.err.wrap(async () => {
        const response = await this.getProfileService().getOwnProfile(
          input.userId
        );
        this.logger.debug(
          `[getOwnProfile] response received for userId: ${input.userId}`
        );
        if (!response.success) {
          return { success: false, error: 'Failed to fetch profile.' };
        }

        const payload = response.payload || {};
        this.logger.log(
          `[getOwnProfile] mapped payload for AI: ${JSON.stringify(payload)}`
        );

        return { success: true, data: response.payload || {} };
      }, 'errors.profile.tool_fetch');
    }
  });

  getProfileRecommendationContext: Tool = tool({
    description:
      'Build recommendation context from order history and profile. Returns separate TOON-encoded blocks for requested components with automatic priority fallback: order > profile > guest_or_new. Use requestedComponents to specify which data sources to include.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      requestedComponents: z
        .array(z.enum(['order', 'profile']))
        .optional()
        .describe(
          'Which components to prioritize: "order" (purchase history), "profile" (saved profile). If omitted, auto-selects by priority: order > profile > guest/new user'
        )
    }),
    execute: async (input) => {
      this.logger.log(
        `[getProfileRecommendationContext] called for userId: ${input.userId}, requestedComponents: ${input.requestedComponents?.join(',') || 'auto (order > profile)'}`
      );

      return await this.err.wrap(async () => {
        const payload = await this.getProfileRecommendationContextPayload(
          input.userId,
          input.requestedComponents
        );

        this.logger.log(
          `[getProfileRecommendationContext] payload for AI: ${JSON.stringify(payload)}`
        );

        return {
          success: true,
          data: payload
        };
      }, 'errors.profile.tool_context');
    }
  });

  /**
   * Tìm kiếm hồ sơ khách hàng theo họ tên, số điện thoại, email hoặc username.
   */
  searchProfile: Tool = tool({
    description:
      'Search for a customer profile by phone number, full name, email, or username. ' +
      'Returns a list of matching users with their UserId (UUID). ' +
      'Staff should use this to find the correct customer ID before using other profile-related tools.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The search query (phone, name, email, or username)')
    }),
    execute: async (input) => {
      this.logger.log(`[searchProfile] called with query: ${input.query}`);
      return await this.err.wrap(async () => {
        const response = await this.getProfileService().searchProfile(
          input.query
        );
        if (!response.success) {
          return {
            success: false,
            error: 'Failed to search for customer profiles.'
          };
        }
        return { success: true, data: response.payload || [] };
      }, 'errors.profile.tool_search');
    }
  });
}
