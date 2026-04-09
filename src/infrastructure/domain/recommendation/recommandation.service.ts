import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Output, UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';
import { INSTRUCTION_TYPE_RECOMMENDATION, INSTRUCTION_TYPE_REPURCHASE } from 'src/application/constant/prompts';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { searchOutput } from 'src/chatbot/output/search.output';
import { buildCombinedPromptV5 } from 'src/infrastructure/domain/utils/prompt-builder';
import { parseAIRecommendationResponse } from 'src/infrastructure/domain/utils/ai-response-parser';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_RECOMMENDATION_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { EmailService, EmailProduct, EmailTemplate } from 'src/infrastructure/domain/common/mail.service';
import {
  ActiveDailyRecommendationRecipient,
  UserService
} from 'src/infrastructure/domain/user/user.service';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';


export type DailyRecommendationTrigger = 'cron' | 'manual';
type DailyRecommendationUserResult =
  | 'sent'
  | 'skipped-no-recommendation'
  | 'skipped-invalid-recipient'
  | 'failed';

export interface DailyRecommendationBatchSummary {
  triggeredBy: DailyRecommendationTrigger;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalRecipients: number;
  sentCount: number;
  skippedNoRecommendation: number;
  skippedInvalidRecipient: number;
  failedCount: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly dailyRecommendationTag = '[DailyRecommendationV3]';
  private readonly dailyRecommendationProductLimit = 2;

  constructor(
    @Inject(AI_RECOMMENDATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
    private readonly prisma: PrismaService,
    private readonly aiAcceptanceService: AIAcceptanceService,
    private readonly profileService: ProfileService
  ) { }

  private uniqueKeywords(items: string[]): string[] {
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 16);
  }

  private splitTerms(input?: string | null): string[] {
    if (!input) return [];
    return input
      .split(/[;,/|\n]/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 50);
  }

  private async hasPurchaseHistory(userId: string): Promise<boolean> {
    const orderResponse = await this.orderService.getOrderDetailsWithOrdersByUserId(userId);
    return Boolean(orderResponse.success && (orderResponse.data?.length ?? 0) > 0);
  }

  private async buildNoPurchaseFallbackResponse(): Promise<string> {
    const newestProductsResponse = await this.productService.getNewestProductsWithVariants({
      PageNumber: 1,
      PageSize: 5,
      SortOrder: 'desc',
      IsDescending: true
    });

    const products = newestProductsResponse.success
      ? (newestProductsResponse.data?.items ?? [])
      : [];

    return JSON.stringify({
      message:
        'Chúng tôi rất trân trọng sự quan tâm của Quý khách. Hiện tại hệ thống chưa ghi nhận đơn hàng trước đó, nên chúng tôi xin gửi một số gợi ý mở đầu để Quý khách khám phá phong cách hương thơm phù hợp nhất.',
      products
    });
  }

  private async generateAIText(
    prompt: string,
    systemPrompt: string,
    userId: string,
    endpoint: string
  ): Promise<string> {
    const response = await this.aiHelper.textGenerateFromPrompt(
      prompt,
      systemPrompt,
      Output.object(searchOutput)
    );
    if (!response.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI recommendation response', {
        userId,
        service: 'AIHelper',
        endpoint
      });
    }
    return response.data ?? '';
  }

  /**
   * Builds a personalized recommendation message + email products using the ConversationV10 pattern:
   * 1. Fetch products from getRecommendationsSimple (Order → Best Seller fallback)
   * 2. Encode them as TOON and inject as RECOMMENDATION_CONTEXT
   * 3. Call the main AI to generate {message, productTemp}
   * 4. Hydrate productTemp into EmailProduct[]
   */
  private async generateRecommendationTextWithProducts(
    userId: string,
    systemPrompt: string,
    combinedPrompt: string,
    limit: number = 3
  ): Promise<{ message: string; emailProducts: EmailProduct[] }> {
    // Step 1: Fetch products from Simple Recommendation (always has results)
    const simpleResult = await this.getRecommendationsSimple(userId, limit);
    const simpleRecs: any[] = simpleResult.success ? (simpleResult.data?.recommendations ?? []) : [];

    // Map to the minimal format the AI understands (same as conversationV10)
    const minimalProducts = simpleRecs.map((rec: any) => ({
      id: rec.productId,
      name: rec.productName,
      brand: rec.brand,
      image: rec.primaryImage,
      variants: (rec.variants || []).map((v: any) => ({
        id: v.id,
        volume: v.volumeMl,
        price: v.basePrice
      })),
      source: rec.source ?? 'RECOMMENDATION'
    }));

    this.logger.log(
      `[RecommendationService][V10_PATTERN] userId=${userId} injecting ${minimalProducts.length} products into AI context`
    );

    // Step 2: Build messages array with RECOMMENDATION_CONTEXT (TOON encoded)
    const encoded = encodeToolOutput(minimalProducts).encoded;
    const contextMessage: UIMessage = {
      id: uuid(),
      role: 'system' as const,
      parts: [{ type: 'text', text: `RECOMMENDATION_CONTEXT: ${encoded}` }]
    };

    const userMessage: UIMessage = {
      id: uuid(),
      role: 'user' as const,
      parts: [{ type: 'text', text: combinedPrompt }]
    };

    // Step 3: Call AI main with textGenerateFromMessages
    const aiResponse = await this.aiHelper.textGenerateFromMessages(
      [contextMessage, userMessage],
      systemPrompt,
      Output.object(searchOutput)
    );

    const rawMessage = aiResponse.success ? aiResponse.data ?? '' : '';
    let parsedAI: { message?: string; productTemp?: any[] } = {};
    try {
      parsedAI = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    } catch {
      parsedAI = { message: rawMessage };
    }

    const aiMessage = parsedAI.message ?? '';

    // Step 4: Hydrate productTemp exactly like conversationV10
    let emailProducts: EmailProduct[] = [];
    const productTemp = Array.isArray(parsedAI.productTemp) ? parsedAI.productTemp : [];

    if (productTemp.length > 0) {
      const ids = productTemp.map((item: any) => item.id).filter((id: any) => !!id);
      if (ids.length > 0) {
        const productResponse = await this.productService.getProductsByIdsForOutput(ids);
        if (productResponse.success && Array.isArray(productResponse.data)) {
          const recommendationsMap = new Map<string, Set<string>>();
          productTemp.forEach((item: any) => {
            if (item.id && Array.isArray(item.variants)) {
              recommendationsMap.set(item.id, new Set(item.variants.map((v: any) => v.id)));
            }
          });

          emailProducts = productResponse.data
            .map((product) => {
              const allowedVariantIds = recommendationsMap.get(product.id);
              const variants = (product.variants || []).filter(v =>
                !allowedVariantIds || allowedVariantIds.has(v.id)
              );
              if (variants.length === 0) return null;
              return this.mapProductCardOutputToEmailProduct(product, variants);
            })
            .filter((p): p is EmailProduct => p !== null)
            .slice(0, limit);
        }
      }
    }

    // If AI didn't produce productTemp or hydration failed, fall back to the Simple products directly
    if (emailProducts.length === 0 && simpleRecs.length > 0) {
      this.logger.warn(
        `[RecommendationService][V10_PATTERN] userId=${userId} productTemp hydration failed, falling back to Simple products directly`
      );
      const ids = simpleRecs.map((r: any) => r.productId).filter(Boolean);
      const productResponse = await this.productService.getProductsByIdsForOutput(ids);
      if (productResponse.success && Array.isArray(productResponse.data)) {
        emailProducts = productResponse.data
          .map((product) => this.mapProductCardOutputToEmailProduct(product, product.variants || []))
          .slice(0, limit);
      }
    }

    return { message: aiMessage, emailProducts };
  }

  /**
   * Maps a ProductCardOutputItem to a EmailProduct for use in email templates.
   */
  private mapProductCardOutputToEmailProduct(
    product: import('src/chatbot/output/product.output').ProductCardOutputItem,
    variants: any[]
  ): EmailProduct {
    return {
      id: product.id,
      name: product.name,
      description: 'Hương nước hoa được gợi ý theo hồ sơ của bạn.',
      brandName: product.brandName ?? 'Unknown',
      categoryName: 'Perfume',
      primaryImage: product.primaryImage ?? undefined,
      variants: variants.slice(0, 3).map((v: any) => ({
        id: v.id,
        sku: v.sku ?? 'N/A',
        volumeMl: Number(v.volumeMl),
        type: 'Standard',
        basePrice: Number(v.basePrice),
        status: 'Active',
        concentrationName: 'N/A'
      }))
    };
  }

  async generateRecommendationText(userId: string): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_RECOMMENDATION,
      this.adminInstructionService,
      userId
    );
    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException('Failed to build combined prompt', {
        userId,
        service: 'PromptBuilder',
        endpoint: 'generateRecommendationText'
      });
    }
    const text = await this.generateAIText(
      promptResult.data.combinedPrompt,
      promptResult.data.adminInstruction ?? '',
      userId,
      'generateRecommendationText'
    );
    return Ok(text);
  }

  async generateRepurchaseText(
    userId: string,
    hasPurchaseHistoryOverride?: boolean
  ): Promise<BaseResponse<string>> {
    const hasPurchaseHistory = hasPurchaseHistoryOverride ?? (await this.hasPurchaseHistory(userId));

    if (!hasPurchaseHistory) {
      const fallback = await this.buildNoPurchaseFallbackResponse();
      return Ok(fallback);
    }

    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_REPURCHASE,
      this.adminInstructionService,
      userId
    );
    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException('Failed to build combined prompt', {
        userId,
        service: 'PromptBuilder',
        endpoint: 'generateRepurchaseText'
      });
    }
    const text = await this.generateAIText(
      promptResult.data.combinedPrompt,
      promptResult.data.adminInstruction ?? '',
      userId,
      'generateRepurchaseText'
    );
    return Ok(text);
  }

  private buildDailyRecommendationMessage(productCount: number): string {
    if (productCount <= 1) {
      return 'Dựa trên hồ sơ và hành vi gần đây, PerfumeGPT đã chọn cho bạn 1 gợi ý phù hợp nhất hôm nay.';
    }

    return `Dựa trên hồ sơ và hành vi gần đây, PerfumeGPT đã chọn ${productCount} gợi ý phù hợp nhất cho bạn hôm nay.`;
  }

  private async attachAcceptanceForEmailProducts(
    userId: string,
    contextType: 'recommendation' | 'repurchase',
    products: EmailProduct[],
    sourceRefId: string
  ): Promise<EmailProduct[]> {
    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }

    const attachResult = await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
      userId,
      contextType,
      sourceRefId,
      products,
      metadata: {
        channel: 'email',
        productCount: products.length
      }
    });

    return attachResult.products as EmailProduct[];
  }

  private mapProductToEmailProduct(
    product: ProductWithVariantsResponse,
    fallbackVariant?: { variantId?: string; basePrice?: number }
  ): EmailProduct {
    const activeVariants = (product.variants ?? []).filter(
      (variant) => variant.status?.toLowerCase() === 'active'
    );
    const sourceVariants =
      activeVariants.length > 0 ? activeVariants : product.variants ?? [];

    const variants = sourceVariants.slice(0, 3).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      volumeMl: variant.volumeMl,
      type: variant.type,
      basePrice: Number(variant.basePrice),
      status: variant.status,
      concentrationName: variant.concentration?.name ?? 'N/A'
    }));

    if (variants.length === 0 && fallbackVariant?.basePrice !== undefined) {
      variants.push({
        id: fallbackVariant.variantId ?? 'fallback-variant',
        sku: 'N/A',
        volumeMl: 50,
        type: 'Standard',
        basePrice: Number(fallbackVariant.basePrice),
        status: 'Active',
        concentrationName: 'N/A'
      });
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description || 'Hương nước hoa được gợi ý theo hồ sơ của bạn.',
      brandName: product.brandName,
      categoryName: product.categoryName || 'Perfume',
      primaryImage: product.primaryImage ?? undefined,
      variants
    };
  }

  private async buildDailyEmailProductsFromV3(
    userId: string
  ): Promise<EmailProduct[]> {
    try {
      const systemPrompt = '📧 Bạn là chuyên gia tư vấn nước hoa cá nhân hóa của PerfumeGPT. Dựa trên RECOMMENDATION_CONTEXT, viết lời chào cá nhân đến khách hàng và gợi ý các sản phẩm trong context.';
      const combinedPrompt = 'Hãy viết lời tư vấn chân thành cho khách hàng dựa trên các sản phẩm trong RECOMMENDATION_CONTEXT.';

      const { message, emailProducts } = await this.generateRecommendationTextWithProducts(
        userId,
        systemPrompt,
        combinedPrompt,
        this.dailyRecommendationProductLimit
      );

      if (emailProducts.length === 0) {
        this.logger.warn(`${this.dailyRecommendationTag}[V3_EMPTY] userId=${userId} reason=NO_PRODUCTS_AFTER_AI`);
        return [];
      }

      return this.attachAcceptanceForEmailProducts(
        userId,
        'recommendation',
        emailProducts,
        `daily-recommendation-${userId}-${Date.now()}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(`${this.dailyRecommendationTag}[V3_FAIL] userId=${userId} error=${errorMessage}`);
      return [];
    }
  }

  private async sendDailyRecommendationForRecipient(
    recipient: ActiveDailyRecommendationRecipient
  ): Promise<DailyRecommendationUserResult> {
    const email = recipient.email?.trim();
    if (!email) {
      this.logger.warn(
        `${this.dailyRecommendationTag}[USER_SKIPPED] userId=${recipient.id} reason=INVALID_RECIPIENT`
      );
      return 'skipped-invalid-recipient';
    }

    const products = await this.buildDailyEmailProductsFromV3(recipient.id);
    if (products.length === 0) {
      this.logger.log(
        `${this.dailyRecommendationTag}[USER_SKIPPED] userId=${recipient.id} reason=NO_RECOMMENDATION`
      );
      return 'skipped-no-recommendation';
    }

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'https://perfumegpt.com'
    );

    const emailResult = await this.emailService.sendTemplateEmail(
      email,
      '🌸 Gợi ý nước hoa hằng ngày từ AI | PerfumeGPT',
      EmailTemplate.RECOMMENDATION,
      {
        userName: recipient.userName || 'Khách hàng',
        heading: 'Gợi ý nước hoa hôm nay dành cho bạn',
        message: this.buildDailyRecommendationMessage(products.length),
        products,
        frontendUrl
      }
    );

    if (!emailResult.success) {
      this.logger.error(
        `${this.dailyRecommendationTag}[USER_FAILED] userId=${recipient.id} email=${email}`
      );
      return 'failed';
    }

    this.logger.log(
      `${this.dailyRecommendationTag}[USER_SENT] userId=${recipient.id} email=${email} productCount=${products.length}`
    );
    return 'sent';
  }

  async sendRecommendationToAllUsers(
    triggeredBy: DailyRecommendationTrigger = 'manual'
  ): Promise<DailyRecommendationBatchSummary> {
    const startedAt = new Date();
    const startedAtMs = Date.now();

    this.logger.log(
      `${this.dailyRecommendationTag}[START] triggeredBy=${triggeredBy} startedAt=${startedAt.toISOString()}`
    );

    const recipientsResponse =
      await this.userService.getActiveUsersForDailyRecommendationEmail();

    if (!recipientsResponse.success || !recipientsResponse.payload) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to load active users for daily recommendation email',
        {
          service: 'UserService',
          endpoint: 'sendRecommendationToAllUsers',
          triggeredBy
        }
      );
    }

    const recipients = recipientsResponse.payload;
    this.logger.log(
      `${this.dailyRecommendationTag}[RECIPIENTS_LOADED] triggeredBy=${triggeredBy} totalRecipients=${recipients.length}`
    );

    let sentCount = 0;
    let skippedNoRecommendation = 0;
    let skippedInvalidRecipient = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const result = await this.sendDailyRecommendationForRecipient(recipient);
        if (result === 'sent') {
          sentCount += 1;
        } else if (result === 'skipped-no-recommendation') {
          skippedNoRecommendation += 1;
        } else if (result === 'skipped-invalid-recipient') {
          skippedInvalidRecipient += 1;
        } else {
          failedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        this.logger.error(
          `${this.dailyRecommendationTag}[USER_FAILED] userId=${recipient.id}`,
          error
        );
      }
    }

    const finishedAt = new Date();
    const summary: DailyRecommendationBatchSummary = {
      triggeredBy,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Date.now() - startedAtMs,
      totalRecipients: recipients.length,
      sentCount,
      skippedNoRecommendation,
      skippedInvalidRecipient,
      failedCount
    };

    this.logger.log(
      `${this.dailyRecommendationTag}[END] triggeredBy=${triggeredBy} totalRecipients=${summary.totalRecipients} sent=${summary.sentCount} skippedNoRecommendation=${summary.skippedNoRecommendation} skippedInvalidRecipient=${summary.skippedInvalidRecipient} failed=${summary.failedCount} durationMs=${summary.durationMs}`
    );

    return summary;
  }

  async sendRecommendation(userId: string): Promise<boolean> {
    try {
      const userInfo = await this.userService.getUserEmailInfo(userId);
      if (!userInfo.success || !userInfo.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfo.payload;

      // Build prompt for AI recommendation using the V10 pattern
      const promptResult = await buildCombinedPromptV5(
        INSTRUCTION_TYPE_RECOMMENDATION,
        this.adminInstructionService,
        userId
      );

      const systemPrompt = promptResult.success ? (promptResult.data?.adminInstruction ?? '') : '';
      const combinedPrompt = promptResult.success ? (promptResult.data?.combinedPrompt ?? '') : '';

      const { message, emailProducts } = await this.generateRecommendationTextWithProducts(
        userId,
        systemPrompt,
        combinedPrompt,
        3
      );

      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://perfumegpt.com');
      const productsWithAcceptance = await this.attachAcceptanceForEmailProducts(
        userId,
        'recommendation',
        emailProducts,
        `recommendation-email-${userId}-${Date.now()}`
      );

      await this.emailService.sendTemplateEmail(
        email,
        '🌸 Khám phá hương nước hoa mới theo gợi ý AI | PerfumeGPT',
        EmailTemplate.RECOMMENDATION,
        {
          userName: userName || 'Khách hàng',
          heading: 'Hương nước hoa được gợi ý dành riêng cho bạn',
          message,
          products: productsWithAcceptance,
          frontendUrl
        }
      );
      this.logger.log(`Sent recommendation email to ${email} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send recommendation for user ${userId}:`, error);
      return false;
    }
  }

  async sendRepurchase(userId: string): Promise<boolean> {
    try {
      const hasPurchaseHistory = await this.hasPurchaseHistory(userId);

      const userInfo = await this.userService.getUserEmailInfo(userId);
      if (!userInfo.success || !userInfo.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfo.payload;

      const result = await this.generateRepurchaseText(userId, hasPurchaseHistory);
      if (!result.success) {
        this.logger.error(`Failed to generate repurchase for user ${userId}`);
        return false;
      }

      const parsed = parseAIRecommendationResponse(result.data ?? '');
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://perfumegpt.com');
      const productsWithAcceptance = await this.attachAcceptanceForEmailProducts(
        userId,
        'repurchase',
        ((parsed.products as EmailProduct[]) || []),
        `repurchase-email-${userId}-${Date.now()}`
      );

      if (!hasPurchaseHistory) {
        await this.emailService.sendTemplateEmail(
          email,
          '🌟 Gợi ý khởi đầu mùi hương dành cho bạn | PerfumeGPT',
          EmailTemplate.RECOMMENDATION,
          {
            userName: userName || 'Khách hàng',
            heading: 'Khám phá những lựa chọn phù hợp cho lần mua đầu tiên',
            message: parsed.message,
            products: productsWithAcceptance,
            frontendUrl
          }
        );
      } else {
        await this.emailService.sendTemplateEmail(
          email,
          '✨ Gợi ý mua lại sản phẩm yêu thích của bạn | PerfumeGPT',
          EmailTemplate.REPURCHASE,
          {
            userName: userName || 'Khách hàng',
            message: parsed.message,
            products: productsWithAcceptance,
            frontendUrl,
            savingsPercent: '15'
          }
        );
      }
      this.logger.log(`Sent repurchase email to ${email} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send repurchase for user ${userId}:`, error);
      return false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyRecommendationCron(): Promise<void> {
    try {
      await this.sendRecommendationToAllUsers('cron');
    } catch (error) {
      this.logger.error(
        `${this.dailyRecommendationTag}[CRON_FAILED] reason=UNEXPECTED_ERROR`,
        error
      );
    }
  }

  // @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Asia/Ho_Chi_Minh' }) // Chạy vào 9h sáng mỗi ngày
  async sendRepurchaseToAllUsers(): Promise<void> {
    this.logger.log('Bắt đầu chạy cron job: Gửi daily repurchase cho tất cả người dùng');
    try {
      const userIds = await this.userService.getAllUserIds();
      for (const userId of userIds.payload ?? []) {
        await this.sendRepurchase(userId);
      }
      this.logger.log('Đã hoàn thành cron job: Gửi daily repurchase');
    } catch (error) {
      this.logger.error('Lỗi khi chạy cron job daily repurchase:', error);
    }
  }

  /**
   * Simple recommendation: Order history → Best Seller fallback
   * Step 1: Extract brand/scent preferences from ALL user orders
   * Step 2a: Query products matching OR(brand, scents)
   * Step 2b: Supplement with best sellers if results are insufficient
   * Step 3: Rank and return top N
   */
  async getRecommendationsSimple(
    userIdRaw: string,
    size: number = 10
  ): Promise<BaseResponse<any>> {
    try {
      const userId = userIdRaw.toLowerCase();
      this.logger.log(`[V3_SIMPLE][START] userId=${userId} size=${size}`);

      // Step 1: Fetch all orders (any status) to build preference profile
      const orders = await this.prisma.orders.findMany({
        where: { CustomerId: userId },
        include: {
          OrderDetails: {
            include: {
              ProductVariants: {
                include: {
                  Products: {
                    include: {
                      Brands: true,
                      ProductNoteMaps: { include: { ScentNotes: true } }
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { CreatedAt: 'desc' },
        take: 50 // cap to recent 50 orders for performance
      });

      const brandCount = new Map<string, number>();
      const scentCount = new Map<string, number>();
      const purchasedProductIds = new Set<string>();
      let totalPrice = 0;
      let totalItems = 0;

      for (const order of orders) {
        for (const detail of order.OrderDetails) {
          const pv = detail.ProductVariants;
          if (!pv) continue;

          const productId = pv.Products?.Id;
          if (productId) purchasedProductIds.add(productId);

          if (pv.BasePrice) {
            totalPrice += Number(pv.BasePrice) * Number(detail.Quantity || 1);
            totalItems += Number(detail.Quantity || 1);
          }

          const brandName = pv.Products?.Brands?.Name;
          if (brandName) brandCount.set(brandName, (brandCount.get(brandName) || 0) + 1);

          const notes = pv.Products?.ProductNoteMaps || [];
          for (const nm of notes) {
            const note = nm.ScentNotes?.Name?.trim();
            if (note) scentCount.set(note, (scentCount.get(note) || 0) + 1);
          }
        }
      }

      const topBrands = Array.from(brandCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const topScents = Array.from(scentCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      let avgPrice = totalItems > 0 ? Math.round(totalPrice / totalItems) : 1_500_000;
      let budgetMin = Math.round(avgPrice * 0.5);
      let budgetMax = Math.round(avgPrice * 2.0);

      // --- PRIORITY 2: PROFILE FALLBACK ---
      const hasOrderPreferences = topBrands.length > 0 || topScents.length > 0;
      if (!hasOrderPreferences) {
        try {
          const profileRes = await this.profileService.getOwnProfile(userId);
          if (profileRes.success && profileRes.payload) {
            const p = profileRes.payload;
            const keywords = this.uniqueKeywords([
              ...this.splitTerms(p.favoriteNotes),
              ...this.splitTerms(p.scentPreference),
              ...this.splitTerms(p.preferredStyle)
            ]);
            
            if (keywords.length > 0) {
              topScents.push(...keywords);
              this.logger.log(`[V3_SIMPLE] Picked up ${keywords.length} keywords from Profile`);
            }
            if (p.minBudget != null && p.maxBudget != null) {
              budgetMin = Number(p.minBudget);
              budgetMax = Number(p.maxBudget);
              avgPrice = (budgetMin + budgetMax) / 2;
            }
          }
        } catch (err: any) {
          this.logger.warn(`[V3_SIMPLE] Profile fallback failed: ${err.message}`);
        }
      }

      this.logger.log(
        `[V3_SIMPLE][PROFILE] userId=${userId} orderPrefs=${hasOrderPreferences} brands=[${topBrands}] scents=[${topScents.slice(0, 5)}] budget=${budgetMin}-${budgetMax}`
      );

      const productInclude = {
        Brands: true,
        Media: { where: { IsPrimary: true } },
        ProductVariants: {
          where: { IsDeleted: false, Status: 'Active' },
          take: 3,
          orderBy: { BasePrice: 'asc' as const }
        }
      };

      let recommendedProducts: any[] = [];
      const seenIds = new Set<string>();

      // Step 2a: Query by order-derived or profile-derived preferences (if any)
      const hasPreferences = topBrands.length > 0 || topScents.length > 0;
      if (hasPreferences) {
        const orConditions: any[] = [];

        if (topBrands.length > 0) {
          orConditions.push({ Brands: { Name: { in: topBrands } } });
        }

        if (topScents.length > 0) {
          // Use fuzzy contains for profile keyword flexibility
          orConditions.push({
            ProductNoteMaps: {
              some: {
                ScentNotes: {
                  OR: topScents.map(scent => ({ Name: { contains: scent } }))
                }
              }
            }
          });
          
          // Also try matching brand just in case the profile keyword is a brand
          orConditions.push({
            Brands: {
              OR: topScents.map(scent => ({ Name: { contains: scent } }))
            }
          });
        }

        const preferenceProducts = await this.prisma.products.findMany({
          where: {
            IsDeleted: false,
            OR: orConditions,
            // Exclude products already purchased
            ...(purchasedProductIds.size > 0
              ? { Id: { notIn: Array.from(purchasedProductIds) } }
              : {})
          },
          include: productInclude,
          take: size * 4
        });

        const sortedByBrand = preferenceProducts.sort((a, b) => {
          const aIsBrand = topBrands.includes(a.Brands?.Name ?? '') ? 1 : 0;
          const bIsBrand = topBrands.includes(b.Brands?.Name ?? '') ? 1 : 0;
          return bIsBrand - aIsBrand;
        });

        for (const p of sortedByBrand) {
          if (!seenIds.has(p.Id)) {
            seenIds.add(p.Id);
            recommendedProducts.push(p);
          }
        }

        this.logger.log(
          `[V3_SIMPLE][PREFERENCE_QUERY] userId=${userId} found=${recommendedProducts.length}`
        );
      }

      // Step 2b: Supplement with best sellers if results are insufficient
      if (recommendedProducts.length < size) {
        const needed = size - recommendedProducts.length;
        this.logger.log(
          `[V3_SIMPLE][BESTSELLER_FILL] userId=${userId} need=${needed} more products`
        );

        const bestSellerResponse = await this.productService.getBestSellingProducts({
          PageNumber: 1,
          PageSize: size * 2,
          SortOrder: 'desc',
          IsDescending: true
        } as PagedAndSortedRequest);

        const bestSellers = bestSellerResponse.success && bestSellerResponse.data
          ? bestSellerResponse.data.items.map((item: any) => item.product)
          : [];

        for (const p of bestSellers) {
          if (!seenIds.has(p.id) && recommendedProducts.length < size * 2) {
            seenIds.add(p.id);
            // Best sellers use a slightly different shape — store as-is for formatting below
            recommendedProducts.push({ _isBestSeller: true, ...p });
          }
        }
      }

      // Step 3: Format and slice final results
      const results = recommendedProducts.slice(0, size).map(p => {
        // Best seller items already have a ProductWithVariantsResponse shape
        if (p._isBestSeller) {
          return {
            productId: p.id,
            productName: p.name,
            brand: p.brandName,
            primaryImage: p.primaryImage,
            variants: (p.variants || []).slice(0, 3).map((v: any) => ({
              id: v.id,
              sku: v.sku,
              volumeMl: v.volumeMl,
              basePrice: v.basePrice
            })),
            source: 'best_seller'
          };
        }

        // Prisma product shape
        return {
          productId: p.Id,
          productName: p.Name,
          brand: p.Brands?.Name ?? null,
          primaryImage: p.Media?.[0]?.Url ?? null,
          variants: (p.ProductVariants || []).map((v: any) => ({
            id: v.Id,
            sku: v.Sku,
            volumeMl: v.VolumeMl,
            basePrice: Number(v.BasePrice)
          })),
          source: hasPreferences ? 'order_preference' : 'best_seller'
        };
      });

      this.logger.log(
        `[V3_SIMPLE][DONE] userId=${userId} returning=${results.length} products`
      );

      return {
        success: true,
        data: {
          userId,
          recommendations: results,
          totalProducts: results.length,
          profile: {
            topBrands,
            topScents,
            avgPrice,
            budgetRange: [budgetMin, budgetMax]
          }
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`[V3_SIMPLE][ERROR] userId=${userIdRaw} error=${errorMessage}`);
      return { success: false, data: null };
    }
  }
}

