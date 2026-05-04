import { Injectable, Logger } from '@nestjs/common';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';

/**
 * Minimal product DTO dùng cho survey search results và AI context.
 * Thay thế inline mapping lặp lại 5 lần trong SurveyService.
 */
export interface MinimalProductDto {
  id: string;
  name: string;
  brand: string;
  image: string;
  category: string;
  description?: string;
  attributes: string[];
  scentNotes: string[];
  olfactoryFamilies: string[];
  variants: MinimalVariantDto[];
  gender: string;
  source?: string;
}

export interface MinimalVariantDto {
  id: string;
  volume: number;
  price: number;
  concentration?: string;
}

/** Budget constraint dùng cho variant filtering */
export interface BudgetConstraint {
  min?: number;
  max?: number;
}

/**
 * Helper xử lý logic sản phẩm cho Survey pipeline.
 * Tách từ SurveyService: hydrate, budget filter, AI acceptance, minimal product mapping.
 */
@Injectable()
export class SurveyProductHelper {
  private readonly logger = new Logger(SurveyProductHelper.name);

  constructor(
    private readonly productService: ProductService,
    private readonly aiAcceptanceService: AIAcceptanceService
  ) {}

  // ==========================================
  // 0. PRODUCT SEARCH
  // ==========================================

  /**
   * Search products by structured analysis query.
   * Wraps ProductService.getProductsByStructuredQuery() và map sang MinimalProductDto[].
   */
  async searchProducts(
    analysis: Record<string, unknown>,
    limit: number = 15
  ): Promise<MinimalProductDto[]> {
    const searchResponse =
      await this.productService.getProductsByStructuredQuery(analysis);
    if (
      !searchResponse.success ||
      !searchResponse.data ||
      searchResponse.data.items.length === 0
    ) {
      return [];
    }
    return this.mapToMinimalProducts(searchResponse.data.items.slice(0, limit));
  }

  /**
   * Search products và enrich variants với concentration info (dùng cho V5).
   * Wraps ProductService.getProductsByStructuredQuery() + map + enrich concentration.
   */
  async searchProductsWithConcentration(
    analysis: Record<string, unknown>,
    limit: number = 20
  ): Promise<MinimalProductDto[]> {
    const searchResponse =
      await this.productService.getProductsByStructuredQuery(analysis);
    if (
      !searchResponse.success ||
      !searchResponse.data ||
      searchResponse.data.items.length === 0
    ) {
      return [];
    }

    const products = this.mapToMinimalProducts(
      searchResponse.data.items.slice(0, limit)
    );
    // Enrich concentration info from original response
    products.forEach((p, idx) => {
      const original = searchResponse.data?.items[idx];
      if (original?.variants) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p.variants = original.variants.map((v: any) => ({
          id: v.id,
          volume: v.volumeMl,
          price: v.basePrice,
          concentration: v.concentration?.name
        }));
      }
    });
    return products;
  }

  // ==========================================
  // 1. MINIMAL PRODUCT MAPPING
  // ==========================================

  /**
   * Map product entity sang MinimalProductDto.
   * Thay thế inline mapping lặp lại 5 lần trong SurveyService.
   */
  mapToMinimalProduct(product: any, source?: string): MinimalProductDto {
    return {
      id: product.id,
      name: product.name,
      brand: product.brandName,
      image: product.primaryImage,
      category: product.categoryName,
      gender: product.gender,
      description: product.description,
      attributes: (product.attributes || []).map(
        (a: any) => `${a.attribute}: ${a.value}`
      ),
      scentNotes: product.scentNotes,
      olfactoryFamilies: product.olfactoryFamilies,
      variants: (product.variants || []).map((v: any) => ({
        id: v.id,
        volume: v.volumeMl,
        price: v.basePrice,
        concentration: v.concentration?.name
      })),
      source: source || product.source
    };
  }

  /**
   * Map danh sách products sang MinimalProductDto[].
   */
  mapToMinimalProducts(products: any[], source?: string): MinimalProductDto[] {
    return products.map((p) => this.mapToMinimalProduct(p, source));
  }

  // ==========================================
  // 2. HYDRATE PRODUCTS
  // ==========================================

  /**
   * Hydrate sản phẩm từ DB bằng IDs, filter variants theo AI recommendation + budget.
   * Gộp logic hydrate lặp lại trong V2, V3, V4, V5.
   *
   * @param productTemp - AI recommendation items (chứa id + variant IDs)
   * @param budget - Budget constraint để filter variants
   * @returns Hydrated products array
   */
  async hydrateAndFilterProducts(
    productTemp: any[],
    budget?: BudgetConstraint
  ): Promise<any[]> {
    if (
      !productTemp ||
      !Array.isArray(productTemp) ||
      productTemp.length === 0
    ) {
      return [];
    }

    const ids = productTemp
      .map((item: any) => item.id)
      .filter((id: string) => !!id)
      .slice(0, 5);

    if (ids.length === 0) return [];

    const productResponse =
      await this.productService.getProductsByIdsForOutput(ids);
    if (!productResponse.success || !productResponse.data) {
      return [];
    }

    // Build AI recommendation map for variant filtering
    const aiRecMap = new Map<string, any>(
      productTemp.map((item: any) => [item.id, item])
    );

    let hydratedProducts = productResponse.data
      .map((product: any) => {
        const aiItem = aiRecMap.get(product.id);

        // Filter variants by AI recommendation
        if (aiItem?.variants && Array.isArray(aiItem.variants)) {
          const variantIdsSet = new Set(aiItem.variants.map((v: any) => v.id));
          return {
            ...product,
            reasoning: aiItem.reasoning || product.reasoning,
            source: aiItem.source || product.source,
            variants: (product.variants || []).filter((v: any) =>
              variantIdsSet.has(v.id)
            )
          };
        }

        return product;
      })
      .filter(
        (product: any) => product.variants && product.variants.length > 0
      );

    // Apply budget filter on variants
    hydratedProducts = this.filterVariantsByBudget(hydratedProducts, budget);

    return hydratedProducts;
  }

  // ==========================================
  // 3. BUDGET FILTER
  // ==========================================

  /**
   * Filter variants theo budget constraint.
   * Loại bỏ duplicate budget filter logic trong V2, V4, V5.
   */
  filterVariantsByBudget(products: any[], budget?: BudgetConstraint): any[] {
    if (!budget || (budget.min === undefined && budget.max === undefined)) {
      return products;
    }

    const min = budget.min ? Number(budget.min) : 0;
    const max = budget.max ? Number(budget.max) : Infinity;

    const filtered = products
      .map((product: any) => {
        const filteredVariants = (product.variants || []).filter((v: any) => {
          const price = Number(v.basePrice || v.price);
          return price >= min && price <= max;
        });
        return { ...product, variants: filteredVariants };
      })
      .filter((product: any) => product.variants.length > 0);

    this.logger.log(
      `[BudgetFilter] Applied: ${min}-${max === Infinity ? '∞' : max}. ` +
        `Products: ${products.length} → ${filtered.length}`
    );

    return filtered;
  }

  /**
   * Filter variants theo budget + concentration + gender.
   * Dùng cho V5 hybrid flow. Gender là hard constraint sau merge.
   */
  filterVariantsByBudgetAndConcentration(
    products: any[],
    budget?: BudgetConstraint,
    concentrations?: Set<string>,
    genderValues?: string[]
  ): any[] {
    if (!budget && (!concentrations || concentrations.size === 0) && (!genderValues || genderValues.length === 0)) {
      return products;
    }

    const min = budget?.min ? Number(budget.min) : undefined;
    const max = budget?.max ? Number(budget.max) : undefined;

    let filtered = products.filter((product: any) => {
      const hasValidVariant = (product.variants || []).some((v: any) => {
        // Budget check
        const price = Number(v.basePrice || v.price);
        if (min !== undefined && price < min) return false;
        if (max !== undefined && price > max) return false;

        // Concentration check
        if (concentrations && concentrations.size > 0 && v.concentration) {
          const variantC = v.concentration.toLowerCase();
          let matched = false;
          for (const requestedC of concentrations) {
            if (
              variantC.includes(requestedC) ||
              requestedC.includes(variantC)
            ) {
              matched = true;
              break;
            }
          }
          if (!matched) return false;
        }

        return true;
      });
      return hasValidVariant;
    });

    // Gender hard filter — applied after budget/concentration
    if (genderValues && genderValues.length > 0) {
      const normalizedGenders = genderValues.map((g) => g.toLowerCase());
      filtered = filtered.filter((product: any) => {
        const productGender = (product.gender ?? '').toLowerCase();
        if (!productGender) return true;
        if (productGender === 'unisex') return true;
        return normalizedGenders.some((g) => productGender === g);
      });
    }

    return filtered;
  }

  // ==========================================
  // 4. AI ACCEPTANCE
  // ==========================================

  /**
   * Attach AI Acceptance record cho danh sách sản phẩm.
   * Gộp logic lặp lại trong V1, V2, V3, V4, V5.
   */
  async attachAIAcceptance(
    products: any[],
    context: {
      contextType: string;
      sourceRefId: string;
      flow: string;
      questionCount: number;
      productCount?: number;
      extra?: Record<string, unknown>;
    }
  ): Promise<{ products: any[]; aiAcceptanceId: string | null }> {
    if (!Array.isArray(products) || products.length === 0) {
      return { products: [], aiAcceptanceId: null };
    }

    const attachResult =
      await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
        contextType: context.contextType as any,
        sourceRefId: context.sourceRefId,
        products,
        metadata: {
          flow: context.flow,
          questionCount: context.questionCount,
          productCount: context.productCount ?? products.length,
          ...context.extra
        }
      });

    return {
      products: attachResult.products,
      aiAcceptanceId: attachResult.aiAcceptanceId
    };
  }

  // ==========================================
  // 5. FALLBACK (BEST SELLERS)
  // ==========================================

  /**
   * Lấy best-selling products làm fallback khi không tìm thấy sản phẩm phù hợp.
   */
  async getBestSellerFallback(): Promise<MinimalProductDto[]> {
    const fallbackResponse = await this.productService.getBestSellingProducts({
      PageNumber: 1,
      PageSize: 5,
      SortOrder: 'desc',
      IsDescending: true
    });

    if (fallbackResponse.success && fallbackResponse.data) {
      return fallbackResponse.data.items.map((item: any) =>
        this.mapToMinimalProduct(item.product, 'BEST_SELLER_FALLBACK')
      );
    }

    return [];
  }
}
