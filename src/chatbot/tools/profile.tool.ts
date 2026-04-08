import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { tool, Tool } from 'ai';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';

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

  constructor(private readonly moduleRef: ModuleRef) {}

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
    orders: OrderResponse[]
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
      orders: normalizedOrders
    };
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

    const orderContext = this.buildOrderContextPayload(orders);
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
      return await funcHandlerAsync(
        async () => {
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
        },
        'Error occurred while fetching profile.',
        true
      );
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

      return await funcHandlerAsync(
        async () => {
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
        },
        'Error occurred while building profile recommendation context.',
        true
      );
    }
  });

  //   createProfileReport: Tool = tool({
  //     description:
  //       'Generate a formatted text report of user profile information including preferences, favorite notes, budget range, and dates.',
  //     inputSchema: z.object({
  //       userId: z.string().describe('The ID of the user'),
  //       favoriteNotes: z.string().optional().describe('User favorite scent notes'),
  //       preferredStyle: z
  //         .string()
  //         .optional()
  //         .describe('User preferred perfume style'),
  //       scentPreference: z.string().optional().describe('User scent preferences'),
  //       minBudget: z.number().optional().describe('Minimum budget range'),
  //       maxBudget: z.number().optional().describe('Maximum budget range')
  //     }),
  //     execute: async (input) => {
  //       return await funcHandlerAsync(
  //         async () => {
  //           const profileData: Partial<ProfileResponse> = {
  //             userId: input.userId,
  //             id: input.userId,
  //             favoriteNotes: input.favoriteNotes,
  //             preferredStyle: input.preferredStyle,
  //             scentPreference: input.scentPreference,
  //             minBudget: input.minBudget,
  //             maxBudget: input.maxBudget
  //           };

  //           const report = await this.profileService.createProfileReport(
  //             profileData as ProfileResponse
  //           );
  //           console.log('ProfileTool - createProfileReport:', report);
  //           return { success: true, data: report };
  //         },
  //         'Error occurred while creating profile report.',
  //         true
  //       );
  //     }
  //   });

  //   createSystemPromptFromProfile: Tool = tool({
  //     description:
  //       'Generate a system prompt for the AI chatbot using user profile information. This helps personalize recommendations.',
  //     inputSchema: z.object({
  //       userId: z.string().describe('The ID of the user'),
  //       favoriteNotes: z.string().optional().describe('User favorite scent notes'),
  //       preferredStyle: z
  //         .string()
  //         .optional()
  //         .describe('User preferred perfume style'),
  //       scentPreference: z.string().optional().describe('User scent preferences'),
  //       minBudget: z.number().optional().describe('Minimum budget range'),
  //       maxBudget: z.number().optional().describe('Maximum budget range'),
  //       authToken: z.string().describe('JWT authentication token')
  //     }),
  //     execute: async (input) => {
  //       return await funcHandlerAsync(
  //         async () => {
  //           // First, try to get the actual profile from the service
  //           let profileData: Partial<ProfileResponse> | undefined;
  //           try {
  //             const profileResponse = await this.profileService.getOwnProfile(
  //               input.authToken
  //             );
  //             if (profileResponse.success) {
  //               profileData = profileResponse.payload;
  //             }
  //           } catch (error) {
  //             console.log('Could not fetch actual profile, using provided data');
  //             profileData = {
  //               userId: input.userId,
  //               id: input.userId,
  //               favoriteNotes: input.favoriteNotes,
  //               preferredStyle: input.preferredStyle,
  //               scentPreference: input.scentPreference,
  //               minBudget: input.minBudget,
  //               maxBudget: input.maxBudget
  //             };
  //           }

  //           const systemPrompt = await this.profileService.createSystemPromptFromProfile(
  //             profileData as ProfileResponse
  //           );
  //           console.log('ProfileTool - createSystemPromptFromProfile:', systemPrompt);
  //           return { success: true, data: systemPrompt };
  //         },
  //         'Error occurred while creating system prompt from profile.',
  //         true
  //       );
  //     }
  //   });
}
