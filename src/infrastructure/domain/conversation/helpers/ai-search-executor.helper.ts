import { Injectable, Logger } from '@nestjs/common';
import { UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';
import {
  AnalysisObject,
  QueryItemObject
} from 'src/chatbot/output/analysis.output';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { CartService } from 'src/infrastructure/domain/cart/cart.service';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { ProfileTool } from 'src/chatbot/tools/profile.tool';

/**
 * Helper thực thi các truy vấn sản phẩm đa luồng (Multi-query execution).
 */
@Injectable()
export class AISearchExecutorHelper {
  private readonly logger = new Logger(AISearchExecutorHelper.name);

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly profileTool: ProfileTool
  ) {}

  /**
   * Điều phối thực thi tất cả các truy vấn đã được phân tách, merge và xóa trùng.
   */
  async executeMultiQueries(
    queries: QueryItemObject[],
    rootAnalysis: AnalysisObject,
    userId: string,
    isGuestUser: boolean,
    pageSize: number
  ): Promise<{ mergedProducts: any[]; taskResults: UIMessage[] }> {
    const allProducts: any[] = [];
    const functionProducts: any[] = [];
    const taskResults: UIMessage[] = [];
    const seenProductIds = new Set<string>();

    this.logger.log(
      `[AISearchExecutorHelper] Executing ${queries.length} decomposed queries`
    );

    for (const query of queries) {
      switch (query.purpose) {
        case 'function': {
          if (!query.functionCall) break;
          const funcName = query.functionCall.name;

          if (
            ['addToCart', 'getCart', 'clearCart', 'getOrdersByUserId'].includes(
              funcName
            )
          ) {
            const taskMsg = await this.handleTaskFunction(
              funcName,
              query.functionCall.arguments,
              userId,
              isGuestUser
            );
            if (taskMsg) taskResults.push(taskMsg);
          } else {
            const items = await this.executeFunctionQuery(query);
            for (const p of items) {
              if (p.id && !seenProductIds.has(p.id)) {
                seenProductIds.add(p.id);
                functionProducts.push(p);
              }
            }
          }
          break;
        }

        case 'profile': {
          if (isGuestUser) break;
          const items = await this.executeProfileQuery(
            userId,
            query,
            rootAnalysis
          );
          for (const p of items) {
            if (p.id && !seenProductIds.has(p.id)) {
              seenProductIds.add(p.id);
              allProducts.push(this.mapToMinimalProduct(p, 'PROFILE_QUERY'));
            }
          }
          break;
        }

        case 'search': {
          const items = await this.executeSearchQuery(query, rootAnalysis);
          for (const p of items) {
            if (p.id && !seenProductIds.has(p.id)) {
              seenProductIds.add(p.id);
              allProducts.push(this.mapToMinimalProduct(p, 'SEARCH_QUERY'));
            }
          }
          break;
        }
      }
    }

    const functionMinimal = functionProducts.map((p) =>
      this.mapToMinimalProduct(p, 'FUNCTION_RESULTS')
    );
    let combined = [...functionMinimal, ...allProducts];

    // Lọc theo ngân sách (Budget strict filter)
    if (
      rootAnalysis.budget &&
      (rootAnalysis.budget.min !== null || rootAnalysis.budget.max !== null)
    ) {
      let { min, max } = rootAnalysis.budget;
      min = min ?? 0;
      max = max ?? Number.MAX_SAFE_INTEGER;
      combined = combined
        .map((p) => ({
          ...p,
          variants: (p.variants || []).filter((v: any) => {
            const price = v.price;
            const fitsMin = min === null || price >= (min as number);
            const fitsMax = max === null || price <= (max as number);
            return fitsMin && fitsMax;
          })
        }))
        .filter((p) => p.variants.length > 0);
    }

    return {
      mergedProducts: combined.slice(0, pageSize),
      taskResults
    };
  }

  private async handleTaskFunction(
    funcName: string,
    args: any,
    userId: string,
    isGuestUser: boolean
  ): Promise<UIMessage | null> {
    if (isGuestUser) {
      return this.createSystemMessage(
        `FUNCTION_ACTION_RESULT: TỪ CHỐI THỰC THI. Tính năng ${funcName} yêu cầu đăng nhập.`
      );
    }

    let res: any;
    if (funcName === 'addToCart') {
      this.logger.log(
        `[TASK][addToCart] UserId: ${userId}, Args: ${JSON.stringify(args)}`
      );
      const items = Array.isArray(args?.items) ? args.items : [];

      if (items.length === 0) {
        this.logger.warn(
          `[TASK][addToCart] No items to add. Full args: ${JSON.stringify(args)}`
        );
      }

      res = await Promise.all(
        items.map(async (i: any) => {
          this.logger.debug(
            `[TASK][addToCart] Processing item: ${JSON.stringify(i)}`
          );
          const addRes = await this.cartService.addToCart(userId, {
            variantId: i.variantId || i.id, // Fallback if AI uses 'id' instead of 'variantId'
            quantity: i.quantity || 1
          });

          this.logger.log(
            `[TASK][addToCart] Result for ${i.variantId || i.id}: Success=${addRes.success}${!addRes.success ? `, Error=${addRes.error}` : ''}`
          );
          return { variantId: i.variantId || i.id, success: addRes.success };
        })
      );
    } else if (funcName === 'getCart') {
      const cartRes = await this.cartService.getCart(userId);
      res = cartRes.success ? cartRes.data : cartRes.error;
    } else if (funcName === 'clearCart') {
      const clearRes = await this.cartService.clearCart(userId);
      res = clearRes.success ? 'Cart Cleared' : clearRes.error;
    } else if (funcName === 'getOrdersByUserId') {
      const orderRes = await this.orderService.getOrdersByUserId(userId, {
        PageNumber: 1,
        PageSize: 5,
        SortOrder: 'desc',
        IsDescending: true
      });
      res = (orderRes as any).data?.items || (orderRes as any).items || [];
    }

    return this.createSystemMessage(
      `FUNCTION_ACTION_RESULT: ${funcName} executed: ${JSON.stringify(res)}`
    );
  }

  private async executeFunctionQuery(query: QueryItemObject): Promise<any[]> {
    if (!query.functionCall) return [];
    const funcName = query.functionCall.name;
    let targetItems: any[] = [];

    if (funcName === 'getBestSellingProducts') {
      const res = await this.productService.getBestSellingProducts({
        PageNumber: 1,
        PageSize: 50,
        SortOrder: 'desc',
        IsDescending: true
      });
      if (res.success && res.data)
        targetItems = res.data.items.map((i: any) => i.product);
    } else if (funcName === 'getNewestProducts') {
      const res = await this.productService.getNewestProductsWithVariants({
        PageNumber: 1,
        PageSize: 50,
        SortOrder: 'desc',
        IsDescending: true
      });
      if (res.success && res.data) targetItems = res.data.items;
    }

    return targetItems;
  }

  private async executeProfileQuery(
    userId: string,
    query: QueryItemObject,
    rootAnalysis: AnalysisObject
  ): Promise<any[]> {
    try {
      const payload =
        await this.profileTool.getProfileRecommendationContextPayload(userId);
      if (!payload || payload.source === 'none') return [];

      const keywords = [
        ...(payload.profileKeywords || []),
        ...(payload.topOrderProducts || []).slice(0, 3)
      ].filter(Boolean);
      if (keywords.length === 0) return [];

      const miniAnalysis: any = {
        logic: [keywords],
        sorting: query.sorting || null,
        budget:
          query.budget ||
          rootAnalysis.budget ||
          (payload.budgetHint
            ? { min: payload.budgetHint.min, max: payload.budgetHint.max }
            : null),
        pagination: { pageNumber: 1, pageSize: 20 }
      };

      const res =
        await this.productService.getProductsByStructuredQuery(miniAnalysis);
      return res.success && res.data ? res.data.items : [];
    } catch {
      return [];
    }
  }

  private async executeSearchQuery(
    query: QueryItemObject,
    rootAnalysis: AnalysisObject
  ): Promise<any[]> {
    const logicGroups = query.logic || [];
    if (logicGroups.length <= 1) {
      const res = await this.productService.getProductsByStructuredQuery({
        ...query,
        ...rootAnalysis
      } as any);
      return res.success && res.data ? res.data.items : [];
    }

    // AND-decomposition logic...
    const subQueryResults = await Promise.all(
      logicGroups.map(async (group) => {
        const res = await this.productService.getProductsByStructuredQuery({
          logic: [group],
          budget: rootAnalysis.budget,
          pagination: { pageSize: 50, pageNumber: 1 }
        } as any);
        return res.success && res.data ? res.data.items : [];
      })
    );

    const scoreMap = new Map<string, { product: any; score: number }>();
    subQueryResults.forEach((products) => {
      products.forEach((p) => {
        const existing = scoreMap.get(p.id);
        if (existing) existing.score += 1;
        else scoreMap.set(p.id, { product: p, score: 1 });
      });
    });

    const sorted = Array.from(scoreMap.values()).sort(
      (a, b) => b.score - a.score
    );
    return sorted.map((e) => e.product);
  }

  private mapToMinimalProduct(product: any, source: string) {
    return {
      id: product.id,
      name: product.name,
      brand: product.brandName,
      category: product.categoryName,
      image: product.primaryImage,
      attributes: (product.attributes || []).map(
        (attr: any) => `${attr.attribute}: ${attr.value}`
      ),
      scentNotes: product.scentNotes,
      olfactoryFamilies: product.olfactoryFamilies,
      variants: (product.variants || []).map((v: any) => ({
        id: v.id,
        volume: v.volumeMl,
        price: v.basePrice
      })),
      source
    };
  }

  private createSystemMessage(text: string): UIMessage {
    return { id: uuid(), role: 'system', parts: [{ type: 'text', text }] };
  }
}
