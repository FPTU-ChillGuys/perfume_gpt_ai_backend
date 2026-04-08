import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Output, UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';

import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { conversationOutput } from 'src/chatbot/output/search.output';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';
import { conversationSystemPrompt, INSTRUCTION_TYPE_CONVERSATION } from 'src/application/constant/prompts';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/domain/utils/message-helper';
import { buildCombinedPromptV5 } from 'src/infrastructure/domain/utils/prompt-builder';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_CONVERSATION_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { ConversationJobName, QueueName } from 'src/application/constant/processor';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import { MessageDto } from 'src/application/dtos/common/message.dto';
import {
  ConversationMapper,
  MessageMapper
} from 'src/application/mapping/custom';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { PagedConversationRequest } from 'src/application/dtos/request/paged-conversation.request';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { SurveyService } from 'src/infrastructure/domain/survey/survey.service';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';

type ProfileContextSource = 'order' | 'survey' | 'chat' | 'none';

type BudgetHint = {
  min: number | null;
  max: number | null;
};

type ProfileContextPayload = {
  source: ProfileContextSource;
  summary: string;
  augmentedKeywords: string[];
  productNames: string[];
  budget: BudgetHint | null;
  dynamicAge: number | null;
  shouldUseBestSellerFallback: boolean;
  shouldAskProfileUpdate: boolean;
};

@Injectable()
export class ConversationV10Service {
  private readonly logger = new Logger(ConversationV10Service.name);

  constructor(
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE)
    private readonly conversationQueue: Queue,
    private readonly productService: ProductService,
    private readonly analysisService: AiAnalysisService,
    private readonly orderService: OrderService,
    private readonly surveyService: SurveyService,
    private readonly profileService: ProfileService
  ) {}

  async addConversation(
    conversationRequest: ConversationDto
  ): Promise<BaseResponse<ConversationDto>> {
    return await funcHandlerAsync(
      async () => {
        const existedConversation = await this.isExistConversation(
          conversationRequest.id || ''
        );

        if (existedConversation) {
          return { success: false, error: 'Conversation already exists' };
        }

        const conversation = new Conversation({
          id: conversationRequest.id || '',
          userId: conversationRequest.userId
        });
        conversation.messages.set(
          MessageMapper.toEntityList(
            conversationRequest.messages || [],
            conversation
          )
        );

        await this.unitOfWork.AIConversationRepo.addConversation(conversation);

        if (conversation.userId) {
          const latestMessage = this.getLastMessage(conversation.messages.getItems());
          if (latestMessage) {
            await this.unitOfWork.EventLogRepo.createMessageEvent(
              conversation.userId,
              latestMessage
            );
          }
          await this.userLogService.enqueueRollingSummaryUpdate(conversation.userId);
        }

        const conversationDto = ConversationMapper.toResponse(conversation, true);
        return { success: true, data: conversationDto };
      },
      'Failed to add conversation',
      true
    );
  }

  async updateMessageToConversation(
    id: string,
    messageDtos: MessageDto[]
  ): Promise<BaseResponse<MessageDto[]>> {
    return await funcHandlerAsync(
      async () => {
        const messages: Message[] = messageDtos.map(
          (msg) =>
            new Message({
              sender: msg.sender as Sender,
              message: msg.message
            })
        );

        const conversation =
          await this.unitOfWork.AIConversationRepo.addMessagesToConversation(
            id,
            messages
          );

        if (conversation.userId) {
          const latestMessage = this.getLastMessage(messages);
          if (latestMessage) {
            await this.unitOfWork.EventLogRepo.createMessageEvent(
              conversation.userId,
              latestMessage
            );
          }
          await this.userLogService.enqueueRollingSummaryUpdate(conversation.userId);
        }

        return {
          success: true,
          data: MessageMapper.toResponseList(conversation.messages.getItems())
        };
      },
      'Failed to update messages',
      true
    );
  }

  async getConversationById(
    id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await funcHandlerAsync(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne(
        { id },
        { populate: ['messages'] }
      );
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      const conversationDto = ConversationMapper.toResponse(conversation, true);
      return { success: true, data: conversationDto };
    }, 'Failed to get conversation by id');
  }

  private getLastMessage(messages: Message[]): Message | undefined {
    if (!messages.length) {
      return undefined;
    }
    return messages[messages.length - 1];
  }

  async isExistConversation(id: string): Promise<boolean> {
    const conversation = await this.unitOfWork.AIConversationRepo.findOne({ id });
    return conversation !== null && conversation !== undefined;
  }

  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await funcHandlerAsync(
      async () => {
        const conversations = await this.unitOfWork.AIConversationRepo.findAll({
          populate: ['messages'],
          orderBy: { updatedAt: 'DESC' }
        });

        const response = ConversationMapper.toResponseList(conversations, true);
        return { success: true, data: response };
      },
      'Failed to get all conversations',
      true
    );
  }

  async getAllConversationsPaginated(
    request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationDto>>> {
    return await funcHandlerAsync(
      async () => {
        const pageNumber = Math.max(Number(request.pageNumber) || 1, 1);
        const pageSize = Math.max(Number(request.pageSize) || 10, 1);

        const where: Record<string, any> = {};
        if (request.userId) {
          where.userId = request.userId;
        }

        const [conversations, totalCount] =
          await this.unitOfWork.AIConversationRepo.findAndCount(where, {
            populate: ['messages'],
            limit: pageSize,
            offset: (pageNumber - 1) * pageSize,
            orderBy: { createdAt: 'DESC' }
          });

        const items = ConversationMapper.toResponseList(conversations, true);
        const totalPages = Math.ceil(totalCount / pageSize);

        const pagedResult = new PagedResult<ConversationDto>({
          items,
          pageNumber,
          pageSize,
          totalCount,
          totalPages
        });

        return { success: true, data: pagedResult };
      },
      'Failed to get paginated conversations',
      true
    );
  }

  public async saveOrUpdateConversation(conversation: ConversationDto): Promise<void> {
    if (!(await this.isExistConversation(conversation?.id ?? ''))) {
      await this.addConversation(conversation);
    } else {
      await this.updateMessageToConversation(
        conversation.id!,
        conversation.messages || []
      );
    }
  }

  private createSystemMessage(text: string): UIMessage {
    return {
      id: uuid(),
      role: 'system',
      parts: [{ type: 'text', text }]
    };
  }

  private createFallbackAnalysis(messageText: string): AnalysisObject {
    return {
      intent: 'Chat',
      logic: [],
      productNames: null,
      sorting: null,
      budget: null,
      pagination: { pageNumber: 1, pageSize: 5 },
      originalRequestVietnamese: messageText,
      normalizationMetadata: null,
      explanation: 'Fallback analysis because intermediate analysis failed'
    };
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

  private getSeasonByLocalTime(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 4 && month <= 9) {
      return 'spring-summer';
    }
    return 'autumn-winter';
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
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 12);
  }

  private buildOrderSummary(orders: OrderResponse[]): {
    topProducts: string[];
    repurchaseHints: string[];
    lines: string[];
  } {
    const productCounter = new Map<string, number>();
    const variantPurchaseDates = new Map<string, { variantName: string; dates: Date[] }>();

    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      for (const detail of order.orderDetails || []) {
        const variantName = detail.variantName || 'Unknown Variant';
        productCounter.set(variantName, (productCounter.get(variantName) || 0) + detail.quantity);

        if (!variantPurchaseDates.has(detail.variantId)) {
          variantPurchaseDates.set(detail.variantId, {
            variantName,
            dates: []
          });
        }
        variantPurchaseDates.get(detail.variantId)!.dates.push(orderDate);
      }
    }

    const topProducts = Array.from(productCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    const repurchaseHints: string[] = [];
    for (const item of variantPurchaseDates.values()) {
      const sortedDates = item.dates
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (sortedDates.length < 2) {
        continue;
      }

      let sumIntervals = 0;
      for (let i = 1; i < sortedDates.length; i += 1) {
        const diffMs = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
        sumIntervals += Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }

      const avgDays = Math.round(sumIntervals / (sortedDates.length - 1));
      repurchaseHints.push(`${item.variantName}: cycle~${avgDays} days`);
      if (repurchaseHints.length >= 6) {
        break;
      }
    }

    const lines = [
      `ordersInHistory=${orders.length}`,
      `topPurchasedProducts=${topProducts.join(' | ') || 'N/A'}`,
      `repurchaseHints=${repurchaseHints.join(' | ') || 'N/A'}`
    ];

    return { topProducts, repurchaseHints, lines };
  }

  private deriveBudgetHint(
    orders: OrderResponse[],
    profile?: ProfileResponse | null
  ): BudgetHint | null {
    const profileMin = profile?.minBudget != null ? Number(profile.minBudget) : null;
    const profileMax = profile?.maxBudget != null ? Number(profile.maxBudget) : null;

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
    const amounts = source.map((order) => Number(order.totalAmount)).filter((amount) => Number.isFinite(amount));

    if (!amounts.length) {
      return null;
    }

    const avg = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

    return {
      min: Math.round(avg * 0.7),
      max: Math.round(avg * 1.3)
    };
  }

  private buildSurveySummary(survey?: SurveyQuestionAnswerResponse | null): {
    lines: string[];
    keywords: string[];
  } {
    if (!survey || !Array.isArray(survey.details) || survey.details.length === 0) {
      return {
        lines: ['surveyDetails=N/A'],
        keywords: []
      };
    }

    const lines: string[] = [];
    const keywords: string[] = [];

    for (const detail of survey.details) {
      const question = detail.question || 'Unknown question';
      const answer = detail.answer || 'Unknown answer';
      lines.push(`${question}: ${answer}`);
      keywords.push(...this.splitTerms(answer));
    }

    return {
      lines,
      keywords: this.uniqueKeywords(keywords)
    };
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

  private async buildProfileContext(
    userId: string,
    isGuestUser: boolean,
    messageText: string,
    previousContext: string
  ): Promise<ProfileContextPayload> {
    const season = this.getSeasonByLocalTime();

    if (isGuestUser) {
      return {
        source: 'chat',
        summary: [
          'profileSource=chat',
          `seasonHint=${season}`,
          `chatMessage=${messageText}`,
          'reason=guest-user-no-profile'
        ].join('\n'),
        augmentedKeywords: [],
        productNames: [],
        budget: null,
        dynamicAge: null,
        shouldUseBestSellerFallback: true,
        shouldAskProfileUpdate: true
      };
    }

    const [ordersResult, surveyResult, profileResult] = await Promise.all([
      this.orderService.getOrderDetailsWithOrdersByUserId(userId).catch(() => ({ success: false } as any)),
      this.surveyService.getLatestSurveyQuesAnwsByUserId(userId).catch(() => ({ success: false } as any)),
      this.profileService.getOwnProfile(userId).catch(() => ({ success: false } as any))
    ]);

    const orders: OrderResponse[] =
      ordersResult?.success && Array.isArray(ordersResult.data)
        ? ordersResult.data.filter(
            (order) => !['Canceled', 'Returned'].includes(order.orderStatus)
          )
        : [];

    const survey = surveyResult?.success ? surveyResult.data : null;
    const profile = profileResult?.success ? profileResult.payload : null;

    const dynamicAge = this.calculateDynamicAge(profile?.dateOfBirth);
    const budget = this.deriveBudgetHint(orders, profile);

    const orderSummary = this.buildOrderSummary(orders);
    const surveySummary = this.buildSurveySummary(survey);
    const profileKeywords = this.extractProfileKeywords(profile);

    const chatFallbackSummary = previousContext
      ? `chatHistoryAvailable=true\nchatContextPreview=${previousContext.substring(0, 250)}`
      : 'chatHistoryAvailable=false';

    if (orders.length > 0) {
      return {
        source: 'order',
        summary: [
          'profileSource=order',
          `seasonHint=${season}`,
          `dynamicAge=${dynamicAge ?? 'unknown'}`,
          `budgetHint=${budget ? `${budget.min ?? 'null'}-${budget.max ?? 'null'}` : 'N/A'}`,
          ...orderSummary.lines,
          `surveyKeywords=${surveySummary.keywords.join(' | ') || 'N/A'}`
        ].join('\n'),
        augmentedKeywords: this.uniqueKeywords([
          ...surveySummary.keywords,
          ...profileKeywords
        ]),
        productNames: orderSummary.topProducts,
        budget,
        dynamicAge,
        shouldUseBestSellerFallback: false,
        shouldAskProfileUpdate: false
      };
    }

    if (surveySummary.keywords.length > 0) {
      return {
        source: 'survey',
        summary: [
          'profileSource=survey',
          `seasonHint=${season}`,
          `dynamicAge=${dynamicAge ?? 'unknown'}`,
          `budgetHint=${budget ? `${budget.min ?? 'null'}-${budget.max ?? 'null'}` : 'N/A'}`,
          ...surveySummary.lines
        ].join('\n'),
        augmentedKeywords: this.uniqueKeywords([
          ...surveySummary.keywords,
          ...profileKeywords
        ]),
        productNames: [],
        budget,
        dynamicAge,
        shouldUseBestSellerFallback: false,
        shouldAskProfileUpdate: false
      };
    }

    return {
      source: 'chat',
      summary: [
        'profileSource=chat',
        `seasonHint=${season}`,
        `dynamicAge=${dynamicAge ?? 'unknown'}`,
        `budgetHint=${budget ? `${budget.min ?? 'null'}-${budget.max ?? 'null'}` : 'N/A'}`,
        chatFallbackSummary,
        'reason=no-order-and-no-survey'
      ].join('\n'),
      augmentedKeywords: this.uniqueKeywords(profileKeywords),
      productNames: [],
      budget,
      dynamicAge,
      shouldUseBestSellerFallback: true,
      shouldAskProfileUpdate: true
    };
  }

  private mergeAnalysisWithProfile(
    analysis: AnalysisObject,
    profileContext: ProfileContextPayload
  ): AnalysisObject {
    const mergedLogic: Array<string | string[]> = Array.isArray(analysis.logic)
      ? [...analysis.logic]
      : [];

    const keywordAugments = profileContext.augmentedKeywords.slice(0, 6);
    if (keywordAugments.length > 0) {
      if (mergedLogic.length === 0) {
        mergedLogic.push(keywordAugments);
      } else {
        const first = mergedLogic[0];
        if (Array.isArray(first)) {
          mergedLogic[0] = Array.from(new Set([...first, ...keywordAugments]));
        } else {
          mergedLogic[0] = Array.from(new Set([first, ...keywordAugments]));
        }
      }
    }

    const mergedProductNames = Array.from(
      new Set([...(analysis.productNames || []), ...profileContext.productNames])
    ).slice(0, 8);

    return {
      ...analysis,
      logic: mergedLogic,
      productNames: mergedProductNames.length > 0 ? mergedProductNames : null,
      budget: analysis.budget || profileContext.budget,
      pagination: analysis.pagination || { pageNumber: 1, pageSize: 5 },
      explanation: `${analysis.explanation || ''} | profileSource=${profileContext.source}`.trim()
    };
  }

  private async buildBestSellerFallbackMessage(limit: number = 5): Promise<UIMessage | null> {
    const fallback = await this.productService.getBestSellingProducts({
      PageNumber: 1,
      PageSize: limit,
      SortOrder: 'desc',
      IsDescending: true
    });

    if (!fallback.success || !fallback.data) {
      return null;
    }

    const minimalProducts = (fallback.data.items || []).map((item: any) => {
      const product = item.product;
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
        variants: (product.variants || []).map((variant: any) => ({
          id: variant.id,
          volume: variant.volumeMl,
          price: variant.basePrice
        })),
        totalSoldQuantity: item.totalSoldQuantity,
        source: 'BEST_SELLER_FALLBACK'
      };
    });

    const encoded = encodeToolOutput(minimalProducts).encoded;
    return this.createSystemMessage(`BEST_SELLER_FALLBACK_RESULTS: ${encoded}`);
  }

  private async processAiChatResponse(
    convertedMessages: UIMessage[],
    conversationMessages: any[],
    conversationId: string,
    userId: string,
    adminInstruction: string | undefined,
    combinedPrompt: string,
    endpoint: string,
    isGuestUser: boolean
  ): Promise<ConversationDto> {
    const lastUserMessage = [...convertedMessages]
      .reverse()
      .find((message) => message.role === 'user');
    const messageText =
      lastUserMessage?.parts.find((part) => part.type === 'text')?.text || '';

    const previousContext = convertedMessages
      .filter((message) => message !== lastUserMessage)
      .map(
        (message) =>
          `${message.role}: ${message.parts.find((part) => part.type === 'text')?.text || ''}`
      )
      .join('\n');

    this.logger.log(
      `[processAiChatResponseV10] Running intermediate analysis for: "${messageText.substring(0, 80)}..."`
    );

    const rawAnalysis =
      (await this.analysisService.analyze(messageText, previousContext)) ||
      this.createFallbackAnalysis(messageText);

    const profileContext = await this.buildProfileContext(
      userId,
      isGuestUser,
      messageText,
      previousContext
    );

    const mergedAnalysis = this.mergeAnalysisWithProfile(rawAnalysis, profileContext);

    let finalMessages = [...convertedMessages];
    finalMessages.push(
      this.createSystemMessage(
        `PROFILE_RECOMMENDATION_CONTEXT:\n${profileContext.summary}`
      )
    );

    finalMessages.push(
      this.createSystemMessage(
        `NORMALIZED_QUERY_ANALYSIS: ${JSON.stringify(mergedAnalysis)}`
      )
    );

    const shouldQueryProducts = ['Search', 'Consult', 'Recommend', 'Compare'].includes(
      mergedAnalysis.intent
    );

    let hasSearchProducts = false;

    if (shouldQueryProducts) {
      this.logger.log(
        `[processAiChatResponseV10] Querying products with structured analysis. intent=${mergedAnalysis.intent}`
      );

      const searchResponse = await this.productService.getProductsByStructuredQuery(
        mergedAnalysis
      );

      if (searchResponse.success && searchResponse.data) {
        const products = searchResponse.data.items;
        if (products.length > 0) {
          const minimalProducts = products.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.brandName,
            category: product.categoryName,
            image: product.primaryImage,
            attributes: (product.attributes || []).map(
              (attr) => `${attr.attribute}: ${attr.value}`
            ),
            scentNotes: product.scentNotes,
            olfactoryFamilies: product.olfactoryFamilies,
            variants: (product.variants || []).map((variant) => ({
              id: variant.id,
              volume: variant.volumeMl,
              price: variant.basePrice
            })),
            source: 'SEARCH_RESULTS'
          }));

          const encodedResults = encodeToolOutput(minimalProducts).encoded;
          finalMessages.push(
            this.createSystemMessage(`SEARCH_RESULTS: ${encodedResults}`)
          );
          hasSearchProducts = true;
        }
      }
    }

    if (profileContext.shouldUseBestSellerFallback && !hasSearchProducts) {
      const fallbackMessage = await this.buildBestSellerFallbackMessage(5);
      if (fallbackMessage) {
        finalMessages.push(fallbackMessage);
      }
    }

    if (profileContext.shouldAskProfileUpdate) {
      finalMessages.push(
        this.createSystemMessage(
          'PROFILE_UPDATE_REQUIRED: true. Bạn phải nhắc người dùng cập nhật profile (sở thích, ngân sách, độ tuổi/survey) nhưng vẫn cần đưa gợi ý sản phẩm từ SEARCH_RESULTS hoặc BEST_SELLER_FALLBACK_RESULTS nếu có.'
        )
      );
    }

    const systemPrompt = conversationSystemPrompt(
      adminInstruction || '',
      combinedPrompt
    );

    this.logger.log(
      '[processAiChatResponseV10] Generating final structured response using main AI'
    );

    const message = await this.aiHelper.textGenerateFromMessages(
      finalMessages,
      systemPrompt,
      Output.object(conversationOutput)
    );

    if (!message.success || !message.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get structured AI response',
        { userId, conversationId, service: 'AIHelper', endpoint }
      );
    }

    const aiResponse =
      typeof message.data === 'string' ? JSON.parse(message.data) : message.data;

    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      const productTemp = aiResponse.productTemp;
      const ids = productTemp.map((item: any) => item.id).filter((id: string) => !!id);

      if (ids.length > 0) {
        const productResponse = await this.productService.getProductsByIdsForOutput(ids);
        if (productResponse.success && productResponse.data) {
          const hydratedProducts = productResponse.data;
          const recommendationsMap = new Map<string, string[]>();

          productTemp.forEach((item: any) => {
            if (item.id && item.variants && Array.isArray(item.variants)) {
              recommendationsMap.set(
                item.id,
                item.variants.map((variant: any) => variant.id)
              );
            }
          });

          aiResponse.products = hydratedProducts
            .map((product) => {
              const recommendedVariantIds = recommendationsMap.get(product.id);
              if (recommendedVariantIds && recommendedVariantIds.length > 0) {
                const variantIdsSet = new Set(recommendedVariantIds);
                return {
                  ...product,
                  variants: (product.variants || []).filter((variant) =>
                    variantIdsSet.has(variant.id)
                  )
                };
              }
              return product;
            })
            .filter((product) => product.variants && product.variants.length > 0);
        }
      }
    }

    const finalMessageData = JSON.stringify(aiResponse);

    const responseConversation = overrideMessagesToConversation(
      conversationId || '',
      userId || '',
      addMessageToMessages(finalMessageData, conversationMessages || [])
    );

    await this.conversationQueue.add(
      ConversationJobName.ADD_MESSAGE_AND_LOG,
      { responseConversation, userId }
    );

    return responseConversation;
  }

  async chat(
    conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const isGuestUser = !conversation.userId;
    const userId = conversation.userId ?? uuid();
    const convertedMessages: UIMessage[] = convertToMessages(conversation.messages || []);

    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_CONVERSATION,
      this.adminInstructionService,
      userId
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          conversationId: conversation.id,
          service: 'PromptBuilder',
          endpoint: 'chat/v10'
        }
      );
    }

    const responseConversation = await this.processAiChatResponse(
      convertedMessages,
      conversation.messages || [],
      conversation.id || '',
      userId,
      promptResult.data.adminInstruction,
      promptResult.data.combinedPrompt,
      'chat/v10',
      isGuestUser
    );

    return Ok(responseConversation);
  }
}
