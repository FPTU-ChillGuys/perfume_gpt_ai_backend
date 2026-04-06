import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Output } from 'ai';
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
import { RecommendationV3Service } from './recommendation-v3.service';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';

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
    private readonly recommendationV3Service: RecommendationV3Service,
    private readonly aiAcceptanceService: AIAcceptanceService
  ) { }

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
    const recommendationResult = await this.recommendationV3Service.getRecommendations(
      userId,
      this.dailyRecommendationProductLimit
    );

    if (!recommendationResult.success) {
      this.logger.warn(
        `${this.dailyRecommendationTag}[V3_FAIL] userId=${userId} reason=RECOMMENDATION_QUERY_FAILED`
      );
      return [];
    }

    const recommendations = recommendationResult.data?.recommendations ?? [];
    if (recommendations.length === 0) {
      this.logger.log(
        `${this.dailyRecommendationTag}[V3_EMPTY] userId=${userId} reason=NO_RECOMMENDATION`
      );
      return [];
    }

    const rankedRecommendations = recommendations.slice(
      0,
      this.dailyRecommendationProductLimit
    );

    const hydratedProducts = await Promise.all(
      rankedRecommendations.map(async (item) => {
        const productResult = await this.productService.getProductWithVariants(
          item.productId
        );

        if (!productResult.success || !productResult.data) {
          this.logger.warn(
            `${this.dailyRecommendationTag}[HYDRATE_SKIP] userId=${userId} productId=${item.productId}`
          );
          return null;
        }

        return this.mapProductToEmailProduct(productResult.data, {
          variantId: item.variantId,
          basePrice: item.basePrice
        });
      })
    );

    const mappedProducts = hydratedProducts
      .filter((product): product is EmailProduct => Boolean(product))
      .slice(0, this.dailyRecommendationProductLimit);

    return this.attachAcceptanceForEmailProducts(
      userId,
      'recommendation',
      mappedProducts,
      `daily-recommendation-${userId}-${Date.now()}`
    );
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

      const result = await this.generateRecommendationText(userId);
      if (!result.success) {
        this.logger.error(`Failed to generate recommendation for user ${userId}`);
        return false;
      }

      const parsed = parseAIRecommendationResponse(result.data ?? '');
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://perfumegpt.com');
      const productsWithAcceptance = await this.attachAcceptanceForEmailProducts(
        userId,
        'recommendation',
        ((parsed.products as EmailProduct[]) || []),
        `recommendation-email-${userId}-${Date.now()}`
      );

      await this.emailService.sendTemplateEmail(
        email,
        '🌸 Khám phá hương nước hoa mới theo gợi ý AI | PerfumeGPT',
        EmailTemplate.RECOMMENDATION,
        {
          userName: userName || 'Khách hàng',
          heading: 'Hương nước hoa được gợi ý dành riêng cho bạn',
          message: parsed.message,
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
}

