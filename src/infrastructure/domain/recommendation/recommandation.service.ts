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
import { ProfileTool } from 'src/chatbot/tools/profile.tool';


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
    private readonly profileTool: ProfileTool
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
    options: {
      limit?: number;
      contextType?: 'recommendation' | 'repurchase';
      orderId?: string;
    } = {}
  ): Promise<{ message: string; emailProducts: EmailProduct[] }> {
    const limit = options.limit || 3;
    const contextType = options.contextType || 'recommendation';

    // Step 1: Fetch products from Simple Recommendation (always has results)
    let simpleResult;
    if (contextType === 'repurchase' && options.orderId) {
      simpleResult = await this.getRepurchaseRecommendationsSimple(userId, options.orderId, limit);
    } else {
      simpleResult = await this.getRecommendationsSimple(userId, limit);
    }
    
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
    const encodedContext = encodeToolOutput(minimalProducts);
    const encoded = encodedContext.encoded;
    
    this.logger.debug(
      `[RecommendationService] [getProfileRecommendationContext] recommendation TOON: ${encoded.length}/${encodedContext.originalSize} (${encodedContext.compressionRatio}%)`
    );

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
    let parsedAI: { message?: string; productTemp?: any[]; products?: any[] } = {};
    try {
      parsedAI = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    } catch {
      parsedAI = { message: rawMessage };
    }

    const aiMessage = parsedAI.message ?? '';

    // Step 4: Hydrate productTemp exactly like conversationV10, but fallback to "products" 
    // because the instruction prompts often tell the AI to use the "products" array.
    let emailProducts: EmailProduct[] = [];
    let productTemp = Array.isArray(parsedAI.productTemp) && parsedAI.productTemp.length > 0
      ? parsedAI.productTemp
      : (Array.isArray(parsedAI.products) ? parsedAI.products : []);

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
        {
          limit: this.dailyRecommendationProductLimit,
          contextType: 'recommendation'
        }
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
        { limit: 3, contextType: 'recommendation' }
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

  async sendRepurchase(userId: string, orderId: string): Promise<boolean> {
    try {
      const userInfo = await this.userService.getUserEmailInfo(userId);
      if (!userInfo.success || !userInfo.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfo.payload;

      const promptResult = await buildCombinedPromptV5(
        INSTRUCTION_TYPE_REPURCHASE,
        this.adminInstructionService,
        userId
      );

      const systemPrompt = promptResult.success ? (promptResult.data?.adminInstruction ?? '') : '';
      const combinedPrompt = promptResult.success ? (promptResult.data?.combinedPrompt ?? '') : '';

      const { message, emailProducts } = await this.generateRecommendationTextWithProducts(
        userId,
        systemPrompt,
        combinedPrompt,
        { limit: 3, contextType: 'repurchase', orderId }
      );

      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://perfumegpt.com');
      const productsWithAcceptance = await this.attachAcceptanceForEmailProducts(
        userId,
        'repurchase',
        emailProducts,
        `repurchase-email-${userId}-${Date.now()}`
      );

      await this.emailService.sendTemplateEmail(
        email,
        '✨ Gợi ý tiếp theo từ PerfumeGPT | Dựa trên đơn hàng của bạn',
        EmailTemplate.REPURCHASE,
        {
          userName: userName || 'Khách hàng',
          message,
          products: productsWithAcceptance,
          frontendUrl,
          savingsPercent: '15'
        }
      );
      this.logger.log(`Sent repurchase email to ${email} for user ${userId} context order ${orderId}`);
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
    this.logger.log('Bắt đầu chạy cron job: Gửi daily repurchase cho tất cả người dùng (SKIPPED vì cần orderId)');
    // Ghi chú: Kịch bản mới bắt buộc có orderId, CronJob này cần được thiết kế lại
    // theo logic lấy các đơn hàng Delivered sau 1 khoảng thời gian thay vì lặp qua toàn bộ User.
  }

  // --- MULTI-QUERY Helpers ---

  /**
   * Builds preference context via ProfileTool (same as ConversationV10).
   * Priority: order history → profile keywords → new_user fallback (best-sellers)
   */
  private async buildPreferencesFromProfileTool(userId: string): Promise<{
    source: string;
    userType: string;
    topBrands: string[];
    topOrderProducts: string[];
    profileKeywords: string[];
    budgetHint: { min: number; max: number } | null;
    budgetMin: number;
    budgetMax: number;
    avgPrice: number;
    purchasedProductIds: Set<string>;
    hasPreferences: boolean;
    contextSummaries: Record<string, any>;
  }> {
    const payload = await this.profileTool.getProfileRecommendationContextPayload(userId);

    const source = payload?.source ?? 'none';
    const userType = source === 'none' ? 'new_user' : 'returning_user';
    const budgetHint = payload?.budgetHint ?? null;
    const topOrderProducts: string[] = payload?.topOrderProducts ?? [];
    const profileKeywords: string[] = payload?.profileKeywords ?? [];
    const contextSummaries = payload?.contextSummaries ?? {};

    // Extract brand names from topOrderProducts (first word if brand is unknown).
    // e.g. "Dior Sauvage EDT 100ml" → "Dior"
    const topBrands = Array.from(
      new Set(
        topOrderProducts
          .map(name => name.split(' ')[0])
          .filter(Boolean)
      )
    ).slice(0, 3);

    const budgetMin = budgetHint?.min ?? 500_000;
    const budgetMax = budgetHint?.max ?? 5_000_000;
    const avgPrice = Math.round((budgetMin + budgetMax) / 2);

    // Collect purchased product IDs to exclude from sub-queries
    const purchasedProductIds = new Set<string>();
    const orderContext = payload?.toonContext?.orderDataToon;
    // Note: PurchasedProductIds are not encoded in toon; we keep this set empty here.
    // Brand/product sub-queries already exclude via label matching.

    const hasPreferences = source !== 'none' && (topOrderProducts.length > 0 || profileKeywords.length > 0);

    this.logger.log(
      `[V3_MULTI_QUERY][PROFILE_CONTEXT] source=${source} userType=${userType} ` +
      `orderCount=${contextSummaries.order?.orderCount ?? 0} ` +
      `topOrderProducts=[${topOrderProducts.slice(0, 3).join(', ')}] ` +
      `budgetHint=${JSON.stringify(budgetHint)}`
    );
    this.logger.log(
      `[V3_MULTI_QUERY][PROFILE_CONTEXT] profileKeywords=[${profileKeywords.join(', ')}] ` +
      `contextSummaries=${JSON.stringify(contextSummaries)}`
    );

    if (!hasPreferences) {
      this.logger.log(`[V3_MULTI_QUERY][NEW_USER] userId=${userId} — No order/profile data, using best-sellers only`);
    }

    return {
      source,
      userType,
      topBrands,
      topOrderProducts,
      profileKeywords,
      budgetHint,
      budgetMin,
      budgetMax,
      avgPrice,
      purchasedProductIds,
      hasPreferences,
      contextSummaries,
    };
  }

  private async buildPreferencesFromOrder(userId: string, orderId: string): Promise<{
    topBrands: string[];
    topOrderProducts: string[];
    budgetHint: { min: number; max: number } | null;
    purchasedProductIds: Set<string>;
    hasPreferences: boolean;
  }> {
    const orderRes = await this.orderService.getOrderById(orderId);
    const order = orderRes.success ? orderRes.payload : null;
    
    if (!order || order.orderDetails.length === 0) {
      return { topBrands: [], topOrderProducts: [], budgetHint: null, purchasedProductIds: new Set(), hasPreferences: false };
    }

    let minPrice = Infinity;
    let maxPrice = 0;
    const variantIds = order.orderDetails.map(d => d.variantId);
    
    order.orderDetails.forEach(item => {
      if (item.unitPrice < minPrice) minPrice = item.unitPrice;
      if (item.unitPrice > maxPrice) maxPrice = item.unitPrice;
    });

    if (minPrice === Infinity) minPrice = 0;

    const budgetHint = { min: minPrice, max: maxPrice + 200000 };

    const topOrderProducts = order.orderDetails.map(d => d.variantName);

    const topBrands = Array.from(
      new Set(
        topOrderProducts
          .map(name => name.split(' ')[0])
          .filter(Boolean)
      )
    ).slice(0, 3);

    const variants = await this.prisma.productVariants.findMany({
      where: { Id: { in: variantIds } },
      select: { ProductId: true }
    });

    const purchasedProductIds = new Set(variants.map(v => v.ProductId));

    this.logger.log(`[V3_MULTI_QUERY][ORDER_CONTEXT] orderId=${orderId} minPrice=${budgetHint.min} maxPrice=${budgetHint.max} topBrands=[${topBrands.join(',')}]`);

    return {
      topBrands,
      topOrderProducts: topOrderProducts.slice(0, 3), // limit keywords to 3
      budgetHint,
      purchasedProductIds, // Will be excluded exactly as requested
      hasPreferences: true
    };
  }

  async getRepurchaseRecommendationsSimple(
    userIdRaw: string,
    orderId: string,
    size: number = 10
  ): Promise<BaseResponse<any>> {
    try {
      const userId = userIdRaw.toLowerCase();
      this.logger.log(`[V3_MULTI_QUERY][REPURCHASE] userId=${userId} orderId=${orderId} size=${size}`);

      const prefs = await this.buildPreferencesFromOrder(userId, orderId);

      // If no valid order items, return generic or empty
      if (!prefs.hasPreferences) {
         return { success: true, data: { recommendations: [] } };
      }

      const promises: Promise<{ label: string; products: any[] }>[] = [];
      const subQueryLimit = size * 2;

      for (const brand of prefs.topBrands) {
        promises.push(this.runBrandSubQuery(brand, prefs.purchasedProductIds, subQueryLimit, prefs.budgetHint).then(products => ({ label: `BRAND:${brand}`, products })));
      }

      if (prefs.hasPreferences && prefs.topOrderProducts.length > 0) {
        promises.push(
          this.runTopProductsSubQuery(prefs.topOrderProducts, prefs.budgetHint, subQueryLimit * 2)
            .then(products => ({ label: 'ORDER_QUERY', products }))
        );
      }

      promises.push(this.runBestSellerSubQuery(size * 2).then(products => {
        const filtered = products.filter(p => !prefs.purchasedProductIds.has(p.id));
        const budgetFiltered = prefs.budgetHint ? filtered.filter(p => {
            const minV = Math.min(...(p.variants||[]).map((v:any) => v.basePrice));
            return minV >= prefs.budgetHint!.min && minV <= prefs.budgetHint!.max;
        }) : filtered;

        return { label: 'BESTSELLER', products: budgetFiltered.length > 0 ? budgetFiltered : filtered };
      }));

      const subResults = await Promise.all(promises);
      const mergedProducts = this.mergeByIntersectionScore(subResults, size);

      const results = mergedProducts.map(p => {
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
            source: prefs.hasPreferences ? (p._matchScore >= 2 ? 'matched_preference' : 'best_seller') : 'best_seller'
          };
        }

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
          source: (p._matchScore && p._matchScore >= 2) ? 'matched_intersection' : 'order_preference'
        };
      });

      this.logger.log(`[V3_MULTI_QUERY][REPURCHASE_DONE] userId=${userId} returning=${results.length} products`);

      return {
        success: true,
        data: {
          userId,
          recommendations: results,
          totalProducts: results.length,
          profile: {
            source: 'order',
            userType: 'returning_user',
            topBrands: prefs.topBrands,
            topOrderProducts: prefs.topOrderProducts,
            budgetRange: prefs.budgetHint ? [prefs.budgetHint.min, prefs.budgetHint.max] : null
          }
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`[V3_MULTI_QUERY][REPURCHASE_ERROR] userId=${userIdRaw} error=${errorMessage}`);
      return { success: false, data: null };
    }
  }

  private readonly productInclude = {
    Brands: true,
    Media: { where: { IsPrimary: true } },
    ProductVariants: {
      where: { IsDeleted: false, Status: 'Active' },
      take: 3,
      orderBy: { BasePrice: 'asc' as const }
    }
  };

  private async runBrandSubQuery(brand: string, excludeIds: Set<string>, limit: number, budgetHint: { min: number; max: number } | null = null): Promise<any[]> {
    const products = await this.prisma.products.findMany({
      where: {
        IsDeleted: false,
        Brands: { Name: brand },
        ...(excludeIds.size > 0 ? { Id: { notIn: Array.from(excludeIds) } } : {}),
        ...(budgetHint ? {
          ProductVariants: {
            some: {
              BasePrice: {
                gte: budgetHint.min,
                lte: budgetHint.max
              }
            }
          }
        } : {})
      },
      include: this.productInclude,
      take: limit
    });
    const topNames = products.slice(0, 5).map(p => p.Name).join(', ');
    this.logger.log(`[V3_MULTI_QUERY][BRAND] brand="${brand}" found=${products.length}. Top: [${topNames}]`);
    return products;
  }

  private async runScentSubQuery(scent: string, excludeIds: Set<string>, limit: number, budgetHint: { min: number; max: number } | null = null): Promise<any[]> {
    const products = await this.prisma.products.findMany({
      where: {
        IsDeleted: false,
        OR: [
          {
            ProductNoteMaps: {
              some: {
                ScentNotes: { Name: { contains: scent } }
              }
            }
          },
          {
            Brands: { OR: [{ Name: { contains: scent } }] }
          }
        ],
        ...(excludeIds.size > 0 ? { Id: { notIn: Array.from(excludeIds) } } : {}),
        ...(budgetHint ? {
          ProductVariants: {
            some: {
              BasePrice: {
                gte: budgetHint.min,
                lte: budgetHint.max
              }
            }
          }
        } : {})
      },
      include: this.productInclude,
      take: limit
    });
    const topNames = products.slice(0, 5).map(p => p.Name).join(', ');
    this.logger.log(`[V3_MULTI_QUERY][SCENT] scent="${scent}" found=${products.length}. Top: [${topNames}]`);
    return products;
  }

  /**
   * Profile-based product sub-query — mirrors ConversationV10's executeProfileQuery.
   * Keywords = profileKeywords (scent/style from profile) + topOrderProducts.slice(0,3)
   * Budget filter applied to narrow results to user's price range.
   */
  private async runTopProductsSubQuery(
    keywords: string[],
    budgetHint: { min: number; max: number } | null,
    limit: number
  ): Promise<any[]> {
    if (keywords.length === 0) return [];

    const miniAnalysis: any = {
      logic: [keywords],     // OR between all combined keywords — same as V10
      productNames: null,
      sorting: null,
      budget: budgetHint,    // KEY: apply budget filter like V10
      pagination: { pageNumber: 1, pageSize: limit }
    };

    const res = await this.productService.getProductsByStructuredQuery(miniAnalysis);
    if (res.success && res.data) {
      const items = res.data.items;
      const topNames = items.slice(0, 5).map((p: any) => p.name).join(', ');
      this.logger.log(
        `[V3_MULTI_QUERY][PROFILE_QUERY] keywords=[${keywords.slice(0, 3).join(', ')}...] ` +
        `budget=${JSON.stringify(budgetHint)} found=${items.length}. Top: [${topNames}]`
      );
      return items;
    }
    this.logger.log(`[V3_MULTI_QUERY][PROFILE_QUERY] found=0`);
    return [];
  }

  private async runBestSellerSubQuery(limit: number): Promise<any[]> {
    const res = await this.productService.getBestSellingProducts({
      PageNumber: 1,
      PageSize: limit,
      SortOrder: 'desc',
      IsDescending: true
    } as PagedAndSortedRequest);
    
    if (res.success && res.data) {
      const items = res.data.items.map((item: any) => ({ _isBestSeller: true, ...item.product }));
      const topNames = items.slice(0, 5).map(p => p.name).join(', ');
      this.logger.log(`[V3_MULTI_QUERY][BESTSELLER] found=${items.length}. Top: [${topNames}]`);
      return items;
    }
    this.logger.log(`[V3_MULTI_QUERY][BESTSELLER] found=0`);
    return [];
  }

  private mergeByIntersectionScore(
    subResults: Array<{ label: string; products: any[] }>,
    size: number
  ): any[] {
    const scoreMap = new Map<string, { product: any; score: number; sources: Set<string> }>();

    for (const sub of subResults) {
      for (const p of sub.products) {
        const pId = p.Id || p.id; // Prisma uses Id, bestseller uses id
        if (!pId) continue;

        if (!scoreMap.has(pId)) {
          scoreMap.set(pId, { product: p, score: 0, sources: new Set() });
        }
        const entry = scoreMap.get(pId)!;
        entry.score += 1;
        entry.sources.add(sub.label);
      }
    }

    const allScored = Array.from(scoreMap.values());
    allScored.sort((a, b) => b.score - a.score); // Highest score first

    // Prefer intersection (score >= 2)
    const intersections = allScored.filter(x => x.score >= 2);
    const unions = allScored.filter(x => x.score < 2);

    const finalResults: any[] = [];
    
    // Fill from intersections
    for (const item of intersections) {
      if (finalResults.length < size) {
        finalResults.push({ ...item.product, _matchScore: item.score });
      }
    }

    // Fill from unions if still needed
    for (const item of unions) {
      if (finalResults.length < size) {
        finalResults.push({ ...item.product, _matchScore: item.score });
      }
    }

    const finalNames = finalResults.map(p => p.Name || p.name).join(', ');
    this.logger.log(`[V3_MULTI_QUERY][MERGE] Total unique=${allScored.length}, Intersections(>=2)=${intersections.length}, Unions=${unions.length}. Result: [${finalNames}]`);

    return finalResults;
  }

  /**
   * Recommendation Pipeline V3 (Multi-Query Decomposition)
   * 1. Extract preference profile
   * 2. Run independent sub-queries for brands, scents, and best-sellers
   * 3. Merge products using an intersection score mechanism
   */
  async getRecommendationsSimple(
    userIdRaw: string,
    size: number = 10
  ): Promise<BaseResponse<any>> {
    try {
      const userId = userIdRaw.toLowerCase();
      this.logger.log(`[V3_MULTI_QUERY][START] userId=${userId} size=${size}`);

      // 1. Build profile/preferences via ProfileTool (same as ConversationV10)
      const prefs = await this.buildPreferencesFromProfileTool(userId);

      // 2. Run sub-queries concurrently
      const promises: Promise<{ label: string; products: any[] }>[] = [];
      const subQueryLimit = size * 2; // Fetch more per sub-query to allow overlap

      // 2.a Brand sub-queries (from order-derived brand names)
      for (const brand of prefs.topBrands) {
        promises.push(this.runBrandSubQuery(brand, prefs.purchasedProductIds, subQueryLimit).then(products => ({ label: `BRAND:${brand}`, products })));
      }

      // 2.b Profile-based sub-query — combines profileKeywords + topOrderProducts like V10's executeProfileQuery
      if (prefs.hasPreferences) {
        const profileQueryKeywords = [
          ...prefs.profileKeywords,
          ...prefs.topOrderProducts.slice(0, 3)
        ].filter(Boolean);

        if (profileQueryKeywords.length > 0) {
          promises.push(
            this.runTopProductsSubQuery(profileQueryKeywords, prefs.budgetHint, subQueryLimit * 2)
              .then(products => ({ label: 'PROFILE_QUERY', products }))
          );
        }
      }

      // 2.c Profile keyword scent sub-queries (for users with profile but no orders)
      if (prefs.source === 'profile' && prefs.profileKeywords.length > 0) {
        for (const scent of prefs.profileKeywords.slice(0, 5)) {
          promises.push(this.runScentSubQuery(scent, prefs.purchasedProductIds, subQueryLimit).then(products => ({ label: `SCENT:${scent}`, products })));
        }
      }

      // 2.d Best Seller default query (always run)
      promises.push(this.runBestSellerSubQuery(size * 2).then(products => {
        // Exclude purchased products explicitly here since bestseller query doesn't accept exclude
        const filtered = products.filter(p => !prefs.purchasedProductIds.has(p.id));
        return { label: 'BESTSELLER', products: filtered };
      }));

      const subResults = await Promise.all(promises);

      // 3. Merge by intersection score
      const mergedProducts = this.mergeByIntersectionScore(subResults, size);

      // 4. Format output
      const results = mergedProducts.map(p => {
        // Best seller or already matched items format check
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
            source: prefs.hasPreferences ? (p._matchScore >= 2 ? 'matched_preference' : 'best_seller') : 'best_seller'
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
          source: (p._matchScore && p._matchScore >= 2) ? 'matched_intersection' : 'order_preference'
        };
      });

      this.logger.log(
        `[V3_MULTI_QUERY][DONE] userId=${userId} returning=${results.length} products`
      );

      return {
        success: true,
        data: {
          userId,
          recommendations: results,
          totalProducts: results.length,
          profile: {
            source: prefs.source,
            userType: prefs.userType,
            topBrands: prefs.topBrands,
            topOrderProducts: prefs.topOrderProducts,
            profileKeywords: prefs.profileKeywords,
            avgPrice: prefs.avgPrice,
            budgetRange: [prefs.budgetMin, prefs.budgetMax]
          }
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`[V3_MULTI_QUERY][ERROR] userId=${userIdRaw} error=${errorMessage}`);
      return { success: false, data: null };
    }
  }
}

