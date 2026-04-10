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
import { AnalysisObject, QueryItemObject } from 'src/chatbot/output/analysis.output';
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
      queries: null,
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

  // ====== Multi-Query Decomposition Methods ======

  private mapToMinimalProduct(product: any, source: string) {
    return {
      id: product.id,
      name: product.name,
      brand: product.brandName,
      category: product.categoryName,
      image: product.primaryImage,
      attributes: (product.attributes || []).map((attr: any) => `${attr.attribute}: ${attr.value}`),
      scentNotes: product.scentNotes,
      olfactoryFamilies: product.olfactoryFamilies,
      variants: (product.variants || []).map((v: any) => ({ id: v.id, volume: v.volumeMl, price: v.basePrice })),
      source
    };
  }

  /**
   * Execute a function-type query (getBestSellingProducts, getNewestProducts, etc.)
   * Returns an array of minimal product objects.
   */
  private async executeFunctionQuery(query: QueryItemObject): Promise<any[]> {
    if (!query.functionCall) return [];
    const funcName = query.functionCall.name;
    this.logger.log(`[V10_MULTI_QUERY][FUNCTION] Executing ${funcName}`);

    let targetItems: any[] = [];
    if (funcName === 'getBestSellingProducts') {
      const res = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: 50, SortOrder: 'desc', IsDescending: true });
      if (res.success && res.data) targetItems = res.data.items.map((i: any) => i.product);
    } else if (funcName === 'getNewestProducts') {
      const res = await this.productService.getNewestProductsWithVariants({ PageNumber: 1, PageSize: 50, SortOrder: 'desc', IsDescending: true });
      if (res.success && res.data) targetItems = res.data.items;
    } else if (funcName === 'getLeastSellingProducts') {
      const res = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: 50, SortOrder: 'asc', IsDescending: false });
      if (res.success && res.data) targetItems = res.data.items.map((i: any) => i.product);
    }

    const productNames = targetItems.slice(0, 5).map(p => p.name).join(', ') + (targetItems.length > 5 ? '...' : '');
    this.logger.log(`[V10_MULTI_QUERY][FUNCTION] ${funcName} returned ${targetItems.length} items. Top: [${productNames}]`);
    return targetItems;
  }

  /**
   * Execute a profile-type query: fetch user profile/order keywords, then search products.
   */
  private async executeProfileQuery(userId: string, query: QueryItemObject): Promise<any[]> {
    this.logger.log(`[V10_MULTI_QUERY][PROFILE] Fetching profile context for userId=${userId}`);
    try {
      const payload = await this.profileTool.getProfileRecommendationContextPayload(userId);
      if (!payload || payload.source === 'none') {
        this.logger.warn(`[V10_MULTI_QUERY][PROFILE] No profile data for userId=${userId}`);
        return [];
      }

      // Extract keywords from profile
      const keywords: string[] = [
        ...(payload.profileKeywords || []),
        ...(payload.topOrderProducts || []).slice(0, 3)
      ].filter(Boolean);

      if (keywords.length === 0) {
        this.logger.warn(`[V10_MULTI_QUERY][PROFILE] No keywords extracted from profile`);
        return [];
      }

      this.logger.log(`[V10_MULTI_QUERY][PROFILE] Profile keywords: ${keywords.slice(0, 5).join(', ')}`);

      // Build a mini-analysis with profile keywords and run search
      const miniAnalysis: any = {
        logic: [keywords], // OR between all profile keywords
        productNames: null,
        sorting: query.sorting || null,
        budget: query.budget || (payload.budgetHint ? { min: payload.budgetHint.min, max: payload.budgetHint.max } : null),
        pagination: { pageNumber: 1, pageSize: 20 }
      };

      const searchResponse = await this.productService.getProductsByStructuredQuery(miniAnalysis);
      if (searchResponse.success && searchResponse.data) {
        const productNames = searchResponse.data.items.slice(0, 5).map(p => p.name).join(', ') + (searchResponse.data.items.length > 5 ? '...' : '');
        this.logger.log(`[V10_MULTI_QUERY][PROFILE] Found ${searchResponse.data.items.length} products from profile query. Top: [${productNames}]`);
        return searchResponse.data.items;
      }
      return [];
    } catch (err) {
      this.logger.warn(`[V10_MULTI_QUERY][PROFILE] Error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * Execute a search-type query using AND-decomposition.
   * Each AND group in logic[] runs as a separate sub-query independently.
   * Results are merged by intersection-score (products matching most sub-queries rank first).
   * Falls back to union if no intersection found.
   */
  private async executeSearchQuery(query: QueryItemObject, rootAnalysis: AnalysisObject): Promise<any[]> {
    const logicGroups = query.logic || [];
    const shared = {
      productNames: query.productNames || null,
      sorting: query.sorting || rootAnalysis.sorting || null,
      budget: query.budget || rootAnalysis.budget || null,
    };

    // If only 0-1 group, skip decomposition and just run normally
    if (logicGroups.length <= 1) {
      const miniAnalysis: any = {
        logic: logicGroups,
        ...shared,
        pagination: { pageNumber: 1, pageSize: 20 }
      };
      this.logger.log(`[V10_MULTI_QUERY][SEARCH] Single group, no decomposition. logic=${JSON.stringify(logicGroups)}`);
      const searchResponse = await this.productService.getProductsByStructuredQuery(miniAnalysis);
      if (searchResponse.success && searchResponse.data) {
        const names = searchResponse.data.items.slice(0, 5).map((p: any) => p.name).join(', ') + (searchResponse.data.items.length > 5 ? '...' : '');
        this.logger.log(`[V10_MULTI_QUERY][SEARCH] Found ${searchResponse.data.items.length} products. Top: [${names}]`);
        return searchResponse.data.items;
      }
      return [];
    }

    // AND-DECOMPOSITION: run each AND group as its own sub-query
    this.logger.log(`[V10_MULTI_QUERY][SEARCH] AND-decomposition: splitting ${logicGroups.length} AND groups into sub-queries`);

    const subQueryResults: Array<{ group: any; products: any[] }> = [];

    for (let i = 0; i < logicGroups.length; i++) {
      const group = logicGroups[i];
      const miniAnalysis: any = {
        logic: [group], // single AND group = just one condition block
        ...shared,
        budget: i === 0 ? shared.budget : null, // only apply budget to first sub-query to avoid over-filtering
        pagination: { pageNumber: 1, pageSize: 50 }
      };

      this.logger.log(`[V10_MULTI_QUERY][SEARCH][SUB-${i + 1}/${logicGroups.length}] Running sub-query for group: ${JSON.stringify(group)}`);
      const subResponse = await this.productService.getProductsByStructuredQuery(miniAnalysis);

      if (subResponse.success && subResponse.data && subResponse.data.items.length > 0) {
        const names = subResponse.data.items.slice(0, 5).map((p: any) => p.name).join(', ') + (subResponse.data.items.length > 5 ? '...' : '');
        this.logger.log(`[V10_MULTI_QUERY][SEARCH][SUB-${i + 1}/${logicGroups.length}] Found ${subResponse.data.items.length} products. Top: [${names}]`);
        subQueryResults.push({ group, products: subResponse.data.items });
      } else {
        this.logger.warn(`[V10_MULTI_QUERY][SEARCH][SUB-${i + 1}/${logicGroups.length}] No results for group: ${JSON.stringify(group)}`);
        subQueryResults.push({ group, products: [] });
      }
    }

    // INTERSECTION-SCORE MERGE: score each product by how many sub-queries it appears in
    const scoreMap = new Map<string, { product: any; score: number }>();

    for (const { products } of subQueryResults) {
      for (const p of products) {
        const existing = scoreMap.get(p.id);
        if (existing) {
          existing.score += 1;
        } else {
          scoreMap.set(p.id, { product: p, score: 1 });
        }
      }
    }

    // Sort by score descending (most sub-queries matched = highest priority)
    const sorted = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);

    // Try intersection first (score === total number of sub-queries with results)
    const subQueriesWithResults = subQueryResults.filter(r => r.products.length > 0).length;
    const intersection = sorted.filter(e => e.score === subQueriesWithResults).map(e => e.product);
    const union = sorted.map(e => e.product);

    if (intersection.length > 0) {
      const names = intersection.slice(0, 5).map((p: any) => p.name).join(', ') + (intersection.length > 5 ? '...' : '');
      this.logger.log(
        `[V10_MULTI_QUERY][SEARCH] Intersection merge: ${intersection.length} products matched ALL ${subQueriesWithResults} sub-queries. Top: [${names}]`
      );
      return intersection;
    }

    // Fallback: union sorted by score
    const names = union.slice(0, 5).map((p: any) => p.name).join(', ') + (union.length > 5 ? '...' : '');
    this.logger.warn(
      `[V10_MULTI_QUERY][SEARCH] No full intersection. Falling back to UNION (${union.length} unique products, ranked by match score). Top: [${names}]`
    );
    return union;
  }

  /**
   * Orchestrate execution of all decomposed queries, merge and deduplicate results.
   */
  private async executeMultiQueries(
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

    this.logger.log(`[V10_MULTI_QUERY] Executing ${queries.length} decomposed queries`);

    for (const query of queries) {
      switch (query.purpose) {
        case 'function': {
          if (!query.functionCall) break;
          const funcName = query.functionCall.name;
          
          // Handle task-type functions (cart, orders) — these don't produce products
          if (['addToCart', 'getCart', 'clearCart'].includes(funcName)) {
            const args: any = query.functionCall.arguments || {};
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
              taskResults.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: ${funcName} executed: ${JSON.stringify(res)}`));
            } else {
              taskResults.push(
                this.createSystemMessage(
                  `FUNCTION_ACTION_RESULT: TỪ CHỐI THỰC THI. Tính năng ${funcName} yêu cầu đăng nhập. BẮT BUỘC phản hồi khách hàng: xin lỗi vì chưa đăng nhập nên không thể lưu giỏ hàng/thao tác, và hướng dẫn họ đăng nhập để hệ thống hỗ trợ tốt hơn.`
                )
              );
            }
          } else if (funcName === 'getOrdersByUserId') {
            if (!isGuestUser) {
              const res = await this.orderService.getOrdersByUserId(userId, { PageNumber: 1, PageSize: 5, SortOrder: 'desc', IsDescending: true });
              const resAny = res as any;
              const itemsData: any[] = resAny.data ? resAny.data.items : (resAny.items ? resAny.items : []);
              const orderItems = itemsData.map((i: any) => ({ id: i.id, code: i.code, status: i.status, total: i.totalAmount }));
              taskResults.push(this.createSystemMessage(`FUNCTION_ACTION_RESULT: getOrdersByUserId executed: ${JSON.stringify(orderItems)}`));
            } else {
              taskResults.push(
                this.createSystemMessage(
                  `FUNCTION_ACTION_RESULT: TỪ CHỐI THỰC THI. Xem đơn hàng yêu cầu đăng nhập. BẮT BUỘC phản hồi khách hàng: xin lỗi vì chưa đăng nhập nên không có dữ liệu đơn hàng, và hướng dẫn họ đăng nhập để kiểm tra.`
                )
              );
            }
          } else {
            // Product-returning functions (getBestSellingProducts, etc.)
            const items = await this.executeFunctionQuery(query);
            for (const p of items) {
              const pid = p.id;
              if (pid && !seenProductIds.has(pid)) {
                seenProductIds.add(pid);
                functionProducts.push(p);
              }
            }
          }
          break;
        }

        case 'profile': {
          if (isGuestUser) break;
          const items = await this.executeProfileQuery(userId, query);
          for (const p of items) {
            const pid = p.id;
            if (pid && !seenProductIds.has(pid)) {
              seenProductIds.add(pid);
              allProducts.push(this.mapToMinimalProduct(p, 'PROFILE_QUERY'));
            }
          }
          break;
        }

        case 'search': {
          const items = await this.executeSearchQuery(query, rootAnalysis);
          for (const p of items) {
            const pid = p.id;
            if (pid && !seenProductIds.has(pid)) {
              seenProductIds.add(pid);
              allProducts.push(this.mapToMinimalProduct(p, 'SEARCH_QUERY'));
            }
          }
          break;
        }
      }
    }

    // Merge strategy: function products come first, then search/profile products
    const functionMinimal = functionProducts.map(p => this.mapToMinimalProduct(p, 'FUNCTION_RESULTS'));
    const mergedProducts = [...functionMinimal, ...allProducts].slice(0, pageSize);

    const mergedNames = mergedProducts.slice(0, 5).map(p => p.name).join(', ') + (mergedProducts.length > 5 ? '...' : '');
    this.logger.log(
      `[V10_MULTI_QUERY] Merge complete: function=${functionMinimal.length} search/profile=${allProducts.length} final=${mergedProducts.length}. Result: [${mergedNames}]`
    );

    return { mergedProducts, taskResults };
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
      `[processAiChatResponseV10] Analysis Result -> Intent: ${finalAnalysis.intent}, queries: ${
        finalAnalysis.queries?.length ?? 0
      }, legacyFunctionCall: ${
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
    const pageSize = finalAnalysis.pagination?.pageSize || 5;

    // ====== NEW: Multi-Query Decomposition Path ======
    const hasDecomposedQueries = Array.isArray(finalAnalysis.queries) && finalAnalysis.queries.length > 0;

    if (hasDecomposedQueries) {
      this.logger.log(`[processAiChatResponseV10] Using MULTI-QUERY path with ${finalAnalysis.queries!.length} queries`);

      const { mergedProducts, taskResults } = await this.executeMultiQueries(
        finalAnalysis.queries!,
        finalAnalysis,
        userId,
        isGuestUser,
        pageSize
      );

      // Inject task results (cart/order actions)
      for (const taskMsg of taskResults) {
        finalMessages.push(taskMsg);
      }

      // Inject merged product results
      if (mergedProducts.length > 0) {
        finalMessages.push(
          this.createSystemMessage(`SEARCH_RESULTS: ${encodeToolOutput(mergedProducts).encoded}`)
        );
        hasSearchProducts = true;
      }
    }
    // ====== LEGACY: Single-query path (backward-compatible) ======
    else if (finalAnalysis.functionCall) {
      const funcName = finalAnalysis.functionCall.name;
      const purpose = finalAnalysis.functionCall.purpose;
      const args: any = finalAnalysis.functionCall.arguments || {};
      
      this.logger.log(`[processAiChatResponseV10] LEGACY functionCall: ${funcName} intercepted, purpose=${purpose}`);

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
          finalMessages.push(
            this.createSystemMessage(
              `FUNCTION_ACTION_RESULT: TỪ CHỐI THỰC THI. Tính năng ${funcName} yêu cầu đăng nhập. BẮT BUỘC phản hồi khách hàng: xin lỗi vì chưa đăng nhập nên không thể lưu giỏ hàng/thao tác, và hướng dẫn họ đăng nhập để hệ thống hỗ trợ tốt hơn.`
            )
          );
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
          finalMessages.push(
            this.createSystemMessage(
              `FUNCTION_ACTION_RESULT: TỪ CHỐI THỰC THI. Xem đơn hàng yêu cầu đăng nhập. BẮT BUỘC phản hồi khách hàng: xin lỗi vì chưa đăng nhập nên không có dữ liệu đơn hàng, và hướng dẫn họ đăng nhập để kiểm tra.`
            )
          );
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
        hasSearchProducts = true; // We now have products to show
      }
    }

    if (!isObjectiveFlow && this.hasAnalysisFlag(finalAnalysis, 'PROFILE_ENRICHMENT_SKIPPED')) {
      if (isGuestUser) {
        finalMessages.push(
          this.createSystemMessage(
            'GUEST_USER_PROMPT: true. Khách chưa đăng nhập. Nhắc khách ĐĂNG NHẬP để hệ thống lưu lại sở thích cá nhân. KHÔNG yêu cầu khách chọn số hay "cập nhật profile" vì họ không có tài khoản. Vẫn tiếp tục tư vấn bình thường nếu có SEARCH_RESULTS.'
          )
        );
      } else {
        finalMessages.push(
          this.createSystemMessage(
            'PROFILE_UPDATE_REQUIRED: true. Bạn phải nhắc người dùng cập nhật profile (sở thích, ngân sách, độ tuổi/survey) nhưng vẫn cần đưa gợi ý sản phẩm từ SEARCH_RESULTS (nếu có).'
          )
        );
      }
    }

    if (!hasSearchProducts && shouldQueryProducts) {
      finalMessages.push(
        this.createSystemMessage(
          'EMPTY_RESULTS_WARNING: Dữ liệu (SEARCH_RESULTS) hoàn toàn rỗng! BẮT BUỘC phản hồi là "hiện tại cửa hàng không tìm thấy sản phẩm nào phù hợp". TUYỆT ĐỐI KHÔNG ĐƯỢC tự nói "có một vài lựa chọn dưới đây" rồi để trống.'
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
