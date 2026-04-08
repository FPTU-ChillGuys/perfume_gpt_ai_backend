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
import { ProfileTool } from 'src/chatbot/tools/profile.tool';

import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { CartService } from 'src/infrastructure/domain/cart/cart.service';

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
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly analysisService: AiAnalysisService,
    private readonly profileTool: ProfileTool
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
      functionCall: null,
      pagination: { pageNumber: 1, pageSize: 5 },
      originalRequestVietnamese: messageText,
      normalizationMetadata: null,
      explanation: 'Fallback analysis because intermediate analysis failed'
    };
  }

  private normalizeAnalysisForQuery(analysis: AnalysisObject): AnalysisObject {
    const normalizedLogic = Array.isArray(analysis.logic) ? analysis.logic : [];
    const normalizedProductNames = Array.isArray(analysis.productNames)
      ? Array.from(new Set(analysis.productNames)).slice(0, 8)
      : [];

    return {
      ...analysis,
      functionCall: analysis.functionCall || null,
      logic: normalizedLogic,
      productNames: normalizedProductNames.length > 0 ? normalizedProductNames : null,
      pagination: analysis.pagination || { pageNumber: 1, pageSize: 5 }
    };
  }

  private hasAnalysisFlag(analysis: AnalysisObject, flag: string): boolean {
    const explanation = (analysis.explanation || '').toUpperCase();
    return explanation.includes(flag.toUpperCase());
  }

  private isObjectiveOrGiftFlow(analysis: AnalysisObject): boolean {
    return (
      this.hasAnalysisFlag(analysis, 'PURE_TREND_QUERY') ||
      this.hasAnalysisFlag(analysis, 'OBJECTIVE_CATALOG_QUERY') ||
      this.hasAnalysisFlag(analysis, 'GIFT_INTENT')
    );
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

  private async buildPersonalizationToonMessages(
    userId: string,
    isGuestUser: boolean,
    analysis: AnalysisObject
  ): Promise<UIMessage[]> {
    if (isGuestUser || this.isObjectiveOrGiftFlow(analysis)) {
      return [];
    }

    if (!['Search', 'Consult', 'Recommend', 'Compare'].includes(analysis.intent)) {
      return [];
    }

    try {
      const payload = await this.profileTool.getProfileRecommendationContextPayload(userId);
      if (!payload || payload.source === 'none') {
        return [];
      }

      const sourcePriority = Array.isArray(payload.sourcePriority)
        ? payload.sourcePriority.join(' > ')
        : 'INPUT > ORDER > SURVEY > PROFILE';

      const messages: UIMessage[] = [
        this.createSystemMessage(
          `PERSONALIZATION_SOURCE_PRIORITY: ${sourcePriority}. Khi dữ liệu xung đột, phải ưu tiên từ trái sang phải.`
        ),
        this.createSystemMessage(
          `PERSONALIZATION_CONTEXT_SUMMARY: ${JSON.stringify(payload.contextSummaries || {})}`
        ),
        this.createSystemMessage(
          `PERSONALIZATION_SIGNALS: ${JSON.stringify({
            source: payload.source,
            budgetHint: payload.budgetHint,
            topOrderProducts: payload.topOrderProducts,
            signals: payload.signals
          })}`
        )
      ];

      const orderToon = payload?.toonContext?.orderDataToon?.encoded;
      const surveyToon = payload?.toonContext?.surveyDataToon?.encoded;
      const profileToon = payload?.toonContext?.profileDataToon?.encoded;

      if (orderToon) {
        messages.push(this.createSystemMessage(`ORDER_CONTEXT_TOON: ${orderToon}`));
      }

      if (surveyToon) {
        messages.push(this.createSystemMessage(`SURVEY_CONTEXT_TOON: ${surveyToon}`));
      }

      if (profileToon) {
        messages.push(this.createSystemMessage(`PROFILE_CONTEXT_TOON: ${profileToon}`));
      }

      return messages;
    } catch (error) {
      this.logger.warn(
        `[processAiChatResponseV10] Failed to build personalization TOON context: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
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
      (await this.analysisService.analyze(messageText, previousContext, {
        userId,
        isGuestUser
      })) ||
      this.createFallbackAnalysis(messageText);

    const finalAnalysis = this.normalizeAnalysisForQuery(rawAnalysis);

    this.logger.log(
      `[processAiChatResponseV10] Analysis Result -> Intent: ${finalAnalysis.intent}, functionCall: ${
        finalAnalysis.functionCall
          ? `${finalAnalysis.functionCall.name} (purpose: ${finalAnalysis.functionCall.purpose})`
          : 'None'
      }`
    );

    let finalMessages = [...convertedMessages];

    const personalizationToonMessages = await this.buildPersonalizationToonMessages(
      userId,
      isGuestUser,
      finalAnalysis
    );

    if (personalizationToonMessages.length > 0) {
      finalMessages.push(...personalizationToonMessages);
    }

    finalMessages.push(
      this.createSystemMessage(
        `NORMALIZED_QUERY_ANALYSIS: ${JSON.stringify(finalAnalysis)}`
      )
    );

    const shouldQueryProducts = ['Search', 'Consult', 'Recommend', 'Compare'].includes(
      finalAnalysis.intent
    );

    let hasSearchProducts = false;

    if (finalAnalysis.functionCall) {
      const funcName = finalAnalysis.functionCall.name;
      const purpose = finalAnalysis.functionCall.purpose;
      const args = finalAnalysis.functionCall.arguments || {};
      
      this.logger.log(`[processAiChatResponseV10] functionCall: ${funcName} intercepted, purpose=${purpose}`);

      if (['getBestSellingProducts'].includes(funcName)) {
        let products: any[] = [];
        let targetItems: any[] = [];

        if (funcName === 'getBestSellingProducts') {
          const res = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: 50, SortOrder: 'desc', IsDescending: true });
          if (res.success && res.data) targetItems = res.data.items.map(i => i.product);
        }

        if (purpose === 'main') {
          products = targetItems.slice(0, finalAnalysis.pagination?.pageSize || 5);
        } else if (purpose === 'support' && shouldQueryProducts) {
          const expandedAnalysis = { ...finalAnalysis, pagination: { pageNumber: 1, pageSize: 50 } };
          const searchResponse = await this.productService.getProductsByStructuredQuery(expandedAnalysis);
          const queryProducts = searchResponse.success && searchResponse.data ? searchResponse.data.items : [];

          if (targetItems.length > 0 && queryProducts.length > 0) {
            const queryProductIds = new Set(queryProducts.map((p) => p.id));
            const intersection = targetItems.filter((p) => queryProductIds.has(p.id));
            if (intersection.length > 0) {
              products = intersection.slice(0, finalAnalysis.pagination?.pageSize || 5);
              this.logger.log(`[processAiChatResponseV10] Support merge: Found matching products, kept top ${products.length} by function rank.`);
            } else {
              products = queryProducts.slice(0, finalAnalysis.pagination?.pageSize || 5);
              this.logger.log(`[processAiChatResponseV10] Support merge: No intersection, fallback to raw query products.`);
            }
          } else {
            products = queryProducts.slice(0, finalAnalysis.pagination?.pageSize || 5);
          }
        }

        if (products.length > 0) {
          const minimalProducts = products.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.brandName,
            category: product.categoryName,
            image: product.primaryImage,
            attributes: (product.attributes || []).map((attr: any) => `${attr.attribute}: ${attr.value}`),
            scentNotes: product.scentNotes,
            olfactoryFamilies: product.olfactoryFamilies,
            variants: (product.variants || []).map((v: any) => ({ id: v.id, volume: v.volumeMl, price: v.basePrice })),
            source: 'FUNCTION_RESULTS'
          }));
          finalMessages.push(this.createSystemMessage(`FUNCTION_RESULTS: ${encodeToolOutput(minimalProducts).encoded}`));
          hasSearchProducts = true;
        }
      } 
      else if (['addToCart', 'getCart', 'clearCart'].includes(funcName)) {
        if (!isGuestUser) {
          let res: any;
          if (funcName === 'addToCart') {
            const items: any[] = Array.isArray(args.items) ? args.items : [];
            const results: any[] = [];
            for (const item of items) {
               if (item.variantId) {
                  const addRes = await this.cartService.addToCart(userId, { variantId: item.variantId, quantity: item.quantity || 1 });
                  results.push({ variantId: item.variantId, success: addRes.success, error: addRes.error });
               }
            }
            res = results;
          } else if (funcName === 'getCart') {
            const cartRes = await this.cartService.getCart(userId);
            res = cartRes.success ? cartRes.data : cartRes.error;
          } else if (funcName === 'clearCart') {
            const clearRes = await this.cartService.clearCart(userId);
            res = clearRes.success ? 'Cart Cleared' : clearRes.error;
          }
          finalMessages.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: ${funcName} executed: ${JSON.stringify(res)}`));
        } else {
          finalMessages.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: User must be logged in to use ${funcName}`));
        }
      } 
      else if (funcName === 'getOrdersByUserId') {
        if (!isGuestUser) {
          const res = await this.orderService.getOrdersByUserId(userId, { PageNumber: 1, PageSize: 5, SortOrder: 'desc', IsDescending: true });
          const resAny = res as any;
          const itemsData: any[] = resAny.data ? resAny.data.items : (resAny.items ? resAny.items : []);
          const orderItems = itemsData.map((i: any) => ({ id: i.id, code: i.code, status: i.status, total: i.totalAmount }));
          finalMessages.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: getOrdersByUserId executed: ${JSON.stringify(orderItems)}`));
        } else {
          finalMessages.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: User must be logged in to view orders`));
        }
      } 
      else if (funcName === 'getUserLogSummaryByUserId') {
        finalMessages.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: getUserLogSummaryByUserId not fully implemented directly in wrapper, please rely on Profile Tool`));
      } 
      else if (funcName === 'getStaticProductPolicy') {
        finalMessages.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: Information is available in policies or general instructions.`));
      }
    } 
    else if (shouldQueryProducts) {
      this.logger.log(`[processAiChatResponseV10] Querying products with structured analysis. intent=${finalAnalysis.intent}`);
      const searchResponse = await this.productService.getProductsByStructuredQuery(finalAnalysis);
      if (searchResponse.success && searchResponse.data && searchResponse.data.items.length > 0) {
        const minimalProducts = searchResponse.data.items.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.brandName,
            category: product.categoryName,
            image: product.primaryImage,
            attributes: (product.attributes || []).map((attr: any) => `${attr.attribute}: ${attr.value}`),
            scentNotes: product.scentNotes,
            olfactoryFamilies: product.olfactoryFamilies,
            variants: (product.variants || []).map((v: any) => ({ id: v.id, volume: v.volumeMl, price: v.basePrice })),
            source: 'SEARCH_RESULTS'
        }));
        finalMessages.push(this.createSystemMessage(`SEARCH_RESULTS: ${encodeToolOutput(minimalProducts).encoded}`));
        hasSearchProducts = true;
      }
    }

    const shouldUseTrendFallback = this.hasAnalysisFlag(finalAnalysis, 'PURE_TREND_QUERY');
    const isObjectiveFlow = this.isObjectiveOrGiftFlow(finalAnalysis);
    const shouldUseBestSellerFallback = shouldUseTrendFallback || isGuestUser;

    if (shouldUseBestSellerFallback && !hasSearchProducts) {
      const fallbackMessage = await this.buildBestSellerFallbackMessage(5);
      if (fallbackMessage) {
        finalMessages.push(fallbackMessage);
      }
    }

    if (!isObjectiveFlow && this.hasAnalysisFlag(finalAnalysis, 'PROFILE_ENRICHMENT_SKIPPED')) {
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
