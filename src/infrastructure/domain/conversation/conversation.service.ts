import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Output, UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';
import { I18nService } from 'nestjs-i18n';

import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { conversationOutput } from 'src/chatbot/output/search.output';
import { AnalysisObject, QueryItemObject } from 'src/chatbot/output/analysis.output';
import { conversationSystemPrompt, INSTRUCTION_TYPE_CONVERSATION, INSTRUCTION_TYPE_STAFF_CONSULTATION } from 'src/application/constant/prompts';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/domain/utils/message-helper';
import { buildCombinedPromptV5 } from 'src/infrastructure/domain/utils/prompt-builder';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_CONVERSATION_HELPER, AI_STAFF_CONVERSATION_HELPER } from 'src/infrastructure/domain/ai/ai.module';
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
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

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
    private readonly profileTool: ProfileTool,
    @Inject(AI_STAFF_CONVERSATION_HELPER) private readonly staffAiHelper: AIHelper,
    private readonly i18n: I18nService
  ) {}

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  async chat(
    conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const isGuestUser = !conversation.userId;
    const userId = conversation.userId ?? uuid();
    const convertedMessages: UIMessage[] = convertToMessages(conversation.messages || []);

    const instructionType = conversation.isStaff
      ? INSTRUCTION_TYPE_STAFF_CONSULTATION
      : INSTRUCTION_TYPE_CONVERSATION;

    const promptResult = await buildCombinedPromptV5(
      instructionType,
      this.adminInstructionService,
      userId
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        this.i18n.t('common.conversation.build_prompt_failed'),
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
      isGuestUser,
      conversation.isStaff || false
    );

    return Ok(responseConversation);
  }

  async addConversation(
    conversationRequest: ConversationDto
  ): Promise<BaseResponse<ConversationDto>> {
    return await funcHandlerAsync(
      async () => {
        const existedConversation = await this.isExistConversation(
          conversationRequest.id || ''
        );

        if (existedConversation) {
          return { success: false, error: this.i18n.t('common.conversation.already_exists') };
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
      this.i18n.t('common.conversation.add_failed'),
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
      this.i18n.t('common.conversation.update_failed'),
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
        return { success: false, error: this.i18n.t('common.conversation.not_found') };
      }

      const conversationDto = ConversationMapper.toResponse(conversation, true);
      return { success: true, data: conversationDto };
    }, this.i18n.t('common.conversation.get_failed'));
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
      this.i18n.t('common.conversation.get_all_failed'),
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
      this.i18n.t('common.conversation.get_paginated_failed'),
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

  async isExistConversation(id: string): Promise<boolean> {
    const conversation = await this.unitOfWork.AIConversationRepo.findOne({ id });
    return conversation !== null && conversation !== undefined;
  }

  // -------------------------------------------------------------------------
  // MAIN ORCHESTRATION
  // -------------------------------------------------------------------------

  private async processAiChatResponse(
    convertedMessages: UIMessage[],
    conversationMessages: any[],
    conversationId: string,
    userId: string,
    adminInstruction: string | undefined,
    combinedPrompt: string,
    endpoint: string,
    isGuestUser: boolean,
    isStaff: boolean
  ): Promise<ConversationDto> {
    
    // 1. Phân tích ý định & bối cảnh
    const { messageText, previousContext } = this.extractMessageContext(convertedMessages);
    const finalAnalysis = await this.performInitialAnalysis(messageText, previousContext, userId, isGuestUser, isStaff);

    // 2. Chuẩn bị thông điệp bổ trợ
    let finalMessages = await this.prepareContextMessages(userId, isGuestUser, finalAnalysis, convertedMessages);

    // 3. Thực thi truy xuất dữ liệu & Actions
    const { products, taskResults, hasResults } = await this.fetchChatContextData(finalAnalysis, userId, isGuestUser);
    
    // Thêm log các hành động (giỏ hàng, đơn hàng) vào tin nhắn context
    finalMessages.push(...taskResults);

    // Thêm kết quả tìm kiếm sản phẩm vào tin nhắn context
    if (products.length > 0) {
      finalMessages.push(this.createSystemMessage(`SEARCH_RESULTS: ${encodeToolOutput(products).encoded}`));
    }

    // 4. Xử lý logic cảnh báo & fallback
    finalMessages = this.applyFlowWarnings(finalAnalysis, hasResults, isGuestUser, finalMessages);

    // 5. Sinh phản hồi AI
    const aiResponseRaw = await this.generateAiResponse(finalMessages, adminInstruction, combinedPrompt, isStaff, {
      userId, conversationId, endpoint
    });

    // 6. Làm giàu dữ liệu sản phẩm (Hydration)
    const hydratedAiResponse = await this.hydrateProductDisplayData(aiResponseRaw, finalAnalysis);

    // 7. Lưu trữ tin nhắn & Queue xử lý ngầm
    return await this.finalizeAndQueueResponse(hydratedAiResponse, conversationId, userId, conversationMessages);
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS: STEP 1 - ANALYSIS
  // -------------------------------------------------------------------------

  private extractMessageContext(messages: UIMessage[]) {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');
    const messageText = lastUserMessage?.parts.find((part) => part.type === 'text')?.text || '';

    const previousContext = messages
      .filter((message) => message !== lastUserMessage)
      .map(
        (message) => `${message.role}: ${message.parts.find((part) => part.type === 'text')?.text || ''}`
      )
      .join('\n');

    return { messageText, previousContext };
  }

  private async performInitialAnalysis(
    messageText: string,
    previousContext: string,
    userId: string,
    isGuestUser: boolean,
    isStaff: boolean
  ): Promise<AnalysisObject> {
    this.logger.log(`[processAiChatResponseV10] Analyzing user intent: "${messageText.substring(0, 80)}..."`);

    const rawAnalysis = await this.analysisService.analyze(messageText, previousContext, {
      userId,
      isGuestUser,
      isStaff
    }) || this.createFallbackAnalysis(messageText);

    const finalAnalysis = this.normalizeAnalysisForQuery(rawAnalysis);

    this.logger.log(
      `[processAiChatResponseV10] Analysis -> Intent: ${finalAnalysis.intent}, queries: ${finalAnalysis.queries?.length ?? 0}, legacyFunc: ${finalAnalysis.functionCall?.name || 'None'}`
    );

    return finalAnalysis;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS: STEP 2 - CONTEXT PREPARATION
  // -------------------------------------------------------------------------

  private async prepareContextMessages(
    userId: string,
    isGuestUser: boolean,
    finalAnalysis: AnalysisObject,
    baseMessages: UIMessage[]
  ): Promise<UIMessage[]> {
    const messages = [...baseMessages];

    const personalizationToonMessages = await this.buildPersonalizationToonMessages(
      userId,
      isGuestUser,
      finalAnalysis
    );

    if (personalizationToonMessages.length > 0) {
      messages.push(...personalizationToonMessages);
    }

    messages.push(this.createSystemMessage(`NORMALIZED_QUERY_ANALYSIS: ${JSON.stringify(finalAnalysis)}`));

    return messages;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS: STEP 3 - DATA FETCHING & TOOL EXECUTION
  // -------------------------------------------------------------------------

  private async fetchChatContextData(
    analysis: AnalysisObject,
    userId: string,
    isGuestUser: boolean
  ): Promise<{ products: any[], taskResults: UIMessage[], hasResults: boolean }> {
    
    let products: any[] = [];
    const taskResults: UIMessage[] = [];
    const pageSize = analysis.pagination?.pageSize || 5;

    // A. Xử lý Multi-Query Decomposition (Ưu tiên path mới)
    if (Array.isArray(analysis.queries) && analysis.queries.length > 0) {
      this.logger.log(`[processAiChatResponseV10] Executing MULTI-QUERY path (${analysis.queries.length} items)`);
      const res = await this.executeMultiQueries(analysis.queries, analysis, userId, isGuestUser, pageSize);
      products = res.mergedProducts;
      taskResults.push(...res.taskResults);
    } 
    // B. Xử lý Legacy Function Call
    else if (analysis.functionCall) {
      this.logger.log(`[processAiChatResponseV10] Executing LEGACY path: ${analysis.functionCall.name}`);
      const res = await this.executeLegacyFunctionCall(analysis.functionCall, analysis, userId, isGuestUser);
      products = res.products;
      if (res.actionResult) taskResults.push(res.actionResult);
    } 
    // C. Xử lý Search thuần túy (Nếu không có tool/multi-query đặc biệt)
    else if (['Search', 'Consult', 'Recommend', 'Compare'].includes(analysis.intent)) {
      this.logger.log(`[processAiChatResponseV10] Executing base structured search`);
      const searchRes = await this.productService.getProductsByStructuredQuery(analysis);
      if (searchRes.success && searchRes.data) {
        products = searchRes.data.items.map(p => this.mapToMinimalProduct(p, 'SEARCH_RESULTS'));
      }
    }

    // D. Xử lý Fallback Best Seller (Nếu các bước trên không có kết quả)
    const hasResults = products.length > 0;
    const isObjective = this.isObjectiveOrGiftFlow(analysis);
    const shouldFallback = (this.hasAnalysisFlag(analysis, 'PURE_TREND_QUERY') || isGuestUser) && !hasResults;

    if (shouldFallback) {
      const fallbackMsg = await this.buildBestSellerFallbackMessage(5);
      if (fallbackMsg) taskResults.push(fallbackMsg);
    }

    return { products, taskResults, hasResults: hasResults || taskResults.some(m => m.parts.some(p => p.type === 'text' && p.text.includes('FALLBACK'))) };
  }

  private async executeLegacyFunctionCall(
    call: any,
    analysis: AnalysisObject,
    userId: string,
    isGuestUser: boolean
  ): Promise<{ products: any[], actionResult: UIMessage | null }> {
    const funcName = call.name;
    const purpose = call.purpose;
    const args = call.arguments || {};

    // 1. Xử lý Action Tool (Giỏ hàng, Đơn hàng, v.v.)
    if (['addToCart', 'getCart', 'clearCart', 'getOrdersByUserId', 'getUserLogSummaryByUserId', 'getStaticProductPolicy'].includes(funcName)) {
      const actionResult = await this.executeActionTool(funcName, args, userId, isGuestUser);
      return { products: [], actionResult };
    }

    // 2. Xử lý Product-returning Tool (Best Seller)
    if (funcName === 'getBestSellingProducts') {
      let targetItems: any[] = [];
      const res = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: 50, SortOrder: 'desc', IsDescending: true });
      if (res.success && res.data) targetItems = res.data.items.map(i => i.product);

      let products: any[] = [];
      if (purpose === 'main') {
        products = targetItems.slice(0, analysis.pagination?.pageSize || 5);
      } else if (purpose === 'support') {
        const searchRes = await this.productService.getProductsByStructuredQuery({ ...analysis, pagination: { pageNumber: 1, pageSize: 50 } });
        const queryProducts = searchRes.success && searchRes.data ? searchRes.data.items : [];
        
        if (targetItems.length > 0 && queryProducts.length > 0) {
          const queryIds = new Set(queryProducts.map(p => p.id));
          const intersection = targetItems.filter(p => queryIds.has(p.id));
          products = intersection.length > 0 ? intersection : queryProducts;
        } else {
          products = queryProducts;
        }
        products = products.slice(0, analysis.pagination?.pageSize || 5);
      }

      const minimal = products.map(p => {
         const mapped = this.mapToMinimalProduct(p, 'FUNCTION_RESULTS');
         // Apply budget filter
         if (analysis.budget && (analysis.budget.min !== null || analysis.budget.max !== null)) {
            const { min, max } = analysis.budget;
            mapped.variants = mapped.variants.filter(v => (min === null || v.price >= min) && (max === null || v.price <= max));
         }
         return mapped;
      }).filter(p => p.variants.length > 0);

      return { products: minimal, actionResult: null };
    }

    return { products: [], actionResult: null };
  }

  private async executeActionTool(
    funcName: string,
    args: any,
    userId: string,
    isGuestUser: boolean
  ): Promise<UIMessage> {
    if (isGuestUser) {
      return this.createSystemMessage(
        `FUNCTION_ACTION_RESULT: TỪ CHỐI THỰC THI. Tính năng ${funcName} yêu cầu đăng nhập. BẮT BUỘC phản hồi: xin lỗi vì chưa đăng nhập nên không thể thực hiện, và hướng dẫn họ đăng nhập.`
      );
    }

    let res: any;
    try {
      if (funcName === 'addToCart') {
        const items = Array.isArray(args.items) ? args.items : [];
        res = await Promise.all(items.map(async (i: any) => {
          if (!i.variantId) return { success: false, error: 'Missing variantId' };
          const addRes = await this.cartService.addToCart(userId, { variantId: i.variantId, quantity: i.quantity || 1 });
          return { variantId: i.variantId, success: addRes.success, error: addRes.error };
        }));
      } else if (funcName === 'getCart') {
        const cartRes = await this.cartService.getCart(userId);
        res = cartRes.success ? cartRes.data : cartRes.error;
      } else if (funcName === 'clearCart') {
        const clearRes = await this.cartService.clearCart(userId);
        res = clearRes.success ? 'Cart Cleared' : clearRes.error;
      } else if (funcName === 'getOrdersByUserId') {
        const orderRes = await this.orderService.getOrdersByUserId(userId, { PageNumber: 1, PageSize: 5, SortOrder: 'desc', IsDescending: true });
        const items = (orderRes as any).data?.items || (orderRes as any).items || [];
        res = items.map((i: any) => ({ id: i.id, code: i.code, status: i.status, total: i.totalAmount }));
      } else {
        res = 'Function partially supported or informational only.';
      }
    } catch (err) {
      this.logger.error(`[executeActionTool] Error executing ${funcName}`, err);
      res = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }

    return this.createSystemMessage(`FUNCTION_ACTION_RESULT: ${funcName} executed: ${JSON.stringify(res)}`);
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS: STEP 4 - AI GENERATION
  // -------------------------------------------------------------------------

  private async generateAiResponse(
    messages: UIMessage[],
    adminInstruction: string | undefined,
    combinedPrompt: string,
    isStaff: boolean,
    context: { userId: string, conversationId: string, endpoint: string }
  ) {
    const systemPrompt = conversationSystemPrompt(adminInstruction || '', combinedPrompt);
    const activeAiHelper = isStaff ? this.staffAiHelper : this.aiHelper;

    const message = await activeAiHelper.textGenerateFromMessages(
      messages,
      systemPrompt,
      Output.object(conversationOutput),
      undefined
    );

    if (!message.success || !message.data) {
      throw new InternalServerErrorWithDetailsException('Failed to get structured AI response', { ...context, service: 'AIHelper' });
    }

    return typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
  }

  private applyFlowWarnings(analysis: AnalysisObject, hasResults: boolean, isGuestUser: boolean, messages: UIMessage[]): UIMessage[] {
    const results = [...messages];
    const isObjective = this.isObjectiveOrGiftFlow(analysis);
    const shouldQuery = ['Search', 'Consult', 'Recommend', 'Compare'].includes(analysis.intent);

    // 1. Cảnh báo dữ liệu rỗng
    if (!hasResults && shouldQuery) {
      results.push(this.createSystemMessage(
        'EMPTY_RESULTS_WARNING: Dữ liệu (SEARCH_RESULTS) hoàn toàn rỗng! BẮT BUỘC phản hồi là "hiện tại cửa hàng không tìm thấy sản phẩm nào phù hợp". TUYỆT ĐỐI KHÔNG ĐƯỢC tự bịa.'
      ));
    }

    // 2. Cảnh báo thiếu Profile
    if (!isObjective && this.hasAnalysisFlag(analysis, 'PROFILE_ENRICHMENT_SKIPPED')) {
      const warningText = isGuestUser 
        ? 'GUEST_USER_PROMPT: Khách chưa đăng nhập. Nhắc khách đăng nhập để cá nhân hóa, nhưng vẫn tư vấn bình thường nếu có kết quả.'
        : 'PROFILE_UPDATE_REQUIRED: Nhắc người dùng cập nhật profile (sở thích, survey) nhưng vẫn đưa gợi ý nếu có kết quả.';
      results.push(this.createSystemMessage(warningText));
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS: STEP 5 - HYDRATION
  // -------------------------------------------------------------------------

  private async hydrateProductDisplayData(aiResponse: any, analysis: AnalysisObject) {
    if (!aiResponse.productTemp || !Array.isArray(aiResponse.productTemp) || aiResponse.productTemp.length === 0) {
      return aiResponse;
    }

    const ids = aiResponse.productTemp.map((item: any) => item.id).filter((id: string) => !!id);
    if (ids.length === 0) return aiResponse;

    const productResponse = await this.productService.getProductsByIdsForOutput(ids);
    if (!productResponse.success || !productResponse.data) return aiResponse;

    const hydratedProducts = productResponse.data;
    const recommendationsMap = new Map<string, string[]>();
    aiResponse.productTemp.forEach((item: any) => {
      if (item.id && Array.isArray(item.variants)) {
        recommendationsMap.set(item.id, item.variants.map((v: any) => v.id));
      }
    });

    aiResponse.products = hydratedProducts.map((product) => {
      const selectedVariantIds = new Set(recommendationsMap.get(product.id) || []);
      if (selectedVariantIds.size === 0) return product;

      return {
        ...product,
        variants: (product.variants || []).filter((variant) => {
          const matchesAi = selectedVariantIds.has(variant.id);
          if (!matchesAi) return false;

          // Re-enforce budget safety check
          if (analysis.budget && (analysis.budget.min !== null || analysis.budget.max !== null)) {
            const { min, max } = analysis.budget;
            const price = variant.basePrice;
            return (min === null || price >= (min as number)) && (max === null || price <= (max as number));
          }
          return true;
        })
      };
    }).filter((p) => p.variants && p.variants.length > 0);

    return aiResponse;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS: STEP 6 - FINALIZATION
  // -------------------------------------------------------------------------

  private async finalizeAndQueueResponse(aiResponse: any, conversationId: string, userId: string, conversationMessages: any[]) {
    const finalMessageData = JSON.stringify(aiResponse);

    const responseConversation = overrideMessagesToConversation(
      conversationId,
      userId,
      addMessageToMessages(finalMessageData, conversationMessages)
    );

    await this.conversationQueue.add(ConversationJobName.ADD_MESSAGE_AND_LOG, {
      responseConversation,
      userId
    });

    return responseConversation;
  }

  // -------------------------------------------------------------------------
  // UTILS & LEGACY WRAPPERS (Preserved logic)
  // -------------------------------------------------------------------------

  private getLastMessage(messages: Message[]): Message | undefined {
    return messages.length ? messages[messages.length - 1] : undefined;
  }

  private createSystemMessage(text: string): UIMessage {
    return { id: uuid(), role: 'system', parts: [{ type: 'text', text }] };
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
    return {
      ...analysis,
      logic: Array.isArray(analysis.logic) ? analysis.logic : [],
      productNames: Array.isArray(analysis.productNames) ? Array.from(new Set(analysis.productNames)).slice(0, 8) : null,
      pagination: analysis.pagination || { pageNumber: 1, pageSize: 5 }
    };
  }

  private hasAnalysisFlag(analysis: AnalysisObject, flag: string): boolean {
    return (analysis.explanation || '').toUpperCase().includes(flag.toUpperCase());
  }

  private isObjectiveOrGiftFlow(analysis: AnalysisObject): boolean {
    return this.hasAnalysisFlag(analysis, 'PURE_TREND_QUERY') ||
           this.hasAnalysisFlag(analysis, 'OBJECTIVE_CATALOG_QUERY') ||
           this.hasAnalysisFlag(analysis, 'GIFT_INTENT');
  }

  private async buildBestSellerFallbackMessage(limit: number = 5): Promise<UIMessage | null> {
    const fallback = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: limit, SortOrder: 'desc', IsDescending: true });
    if (!fallback.success || !fallback.data) return null;

    const minimal = (fallback.data.items || []).map((item: any) => ({
      ...this.mapToMinimalProduct(item.product, 'BEST_SELLER_FALLBACK'),
      totalSoldQuantity: item.totalSoldQuantity
    }));

    return this.createSystemMessage(`BEST_SELLER_FALLBACK_RESULTS: ${encodeToolOutput(minimal).encoded}`);
  }

  private async buildPersonalizationToonMessages(userId: string, isGuestUser: boolean, analysis: AnalysisObject): Promise<UIMessage[]> {
    if (isGuestUser || this.isObjectiveOrGiftFlow(analysis)) return [];
    if (!['Search', 'Consult', 'Recommend', 'Compare'].includes(analysis.intent)) return [];

    try {
      const payload = await this.profileTool.getProfileRecommendationContextPayload(userId);
      if (!payload || payload.source === 'none') return [];

      const messages = [
        this.createSystemMessage(`PERSONALIZATION_SOURCE_PRIORITY: ${Array.isArray(payload.sourcePriority) ? payload.sourcePriority.join(' > ') : 'INPUT > ORDER > SURVEY > PROFILE'}`),
        this.createSystemMessage(`PERSONALIZATION_CONTEXT_SUMMARY: ${JSON.stringify(payload.contextSummaries || {})}`),
        this.createSystemMessage(`PERSONALIZATION_SIGNALS: ${JSON.stringify({ source: payload.source, budgetHint: payload.budgetHint, topOrderProducts: payload.topOrderProducts, signals: payload.signals })}`)
      ];

      if (payload.toonContext?.orderDataToon?.encoded) messages.push(this.createSystemMessage(`ORDER_CONTEXT_TOON: ${payload.toonContext.orderDataToon.encoded}`));
      if (payload.toonContext?.surveyDataToon?.encoded) messages.push(this.createSystemMessage(`SURVEY_CONTEXT_TOON: ${payload.toonContext.surveyDataToon.encoded}`));
      if (payload.toonContext?.profileDataToon?.encoded) messages.push(this.createSystemMessage(`PROFILE_CONTEXT_TOON: ${payload.toonContext.profileDataToon.encoded}`));

      return messages;
    } catch (err) {
      this.logger.warn(`[V10] Personalization fail`, err);
      return [];
    }
  }

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

  private async executeFunctionQuery(query: QueryItemObject): Promise<any[]> {
    if (!query.functionCall) return [];
    const name = query.functionCall.name;
    let items: any[] = [];
    if (name === 'getBestSellingProducts') {
      const res = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: 50, SortOrder: 'desc', IsDescending: true });
      if (res.success && res.data) items = res.data.items.map((i: any) => i.product);
    } else if (name === 'getNewestProducts') {
      const res = await this.productService.getNewestProductsWithVariants({ PageNumber: 1, PageSize: 50, SortOrder: 'desc', IsDescending: true });
      if (res.success && res.data) items = res.data.items;
    } else if (name === 'getLeastSellingProducts') {
      const res = await this.productService.getBestSellingProducts({ PageNumber: 1, PageSize: 50, SortOrder: 'asc', IsDescending: false });
      if (res.success && res.data) items = res.data.items.map((i: any) => i.product);
    }
    return items;
  }

  private async executeProfileQuery(userId: string, query: QueryItemObject, root: AnalysisObject): Promise<any[]> {
    try {
      const payload = await this.profileTool.getProfileRecommendationContextPayload(userId);
      if (!payload || payload.source === 'none') return [];
      const keywords = [...(payload.profileKeywords || []), ...(payload.topOrderProducts || []).slice(0, 3)].filter(Boolean);
      if (keywords.length === 0) return [];

      const searchRes = await this.productService.getProductsByStructuredQuery({
        logic: [keywords],
        productNames: null,
        sorting: query.sorting || null,
        budget: query.budget || root.budget || (payload.budgetHint ? { min: payload.budgetHint.min, max: payload.budgetHint.max } : null),
        pagination: { pageNumber: 1, pageSize: 20 }
      });
      return searchRes.success && searchRes.data ? searchRes.data.items : [];
    } catch (err) {
      return [];
    }
  }

  private async executeSearchQuery(query: QueryItemObject, root: AnalysisObject): Promise<any[]> {
    const logicGroups = query.logic || [];
    const shared = { productNames: query.productNames || null, sorting: query.sorting || root.sorting || null, budget: query.budget || root.budget || null };

    if (logicGroups.length <= 1) {
      const res = await this.productService.getProductsByStructuredQuery({ logic: logicGroups, ...shared, pagination: { pageNumber: 1, pageSize: 20 } });
      return res.success && res.data ? res.data.items : [];
    }

    const subResults: any[][] = [];
    for (let i = 0; i < logicGroups.length; i++) {
      const res = await this.productService.getProductsByStructuredQuery({ logic: [logicGroups[i]], ...shared, budget: i === 0 ? shared.budget : null, pagination: { pageNumber: 1, pageSize: 50 } });
      if (res.success && res.data) subResults.push(res.data.items);
    }

    const scoreMap = new Map<string, { p: any; s: number }>();
    for (const products of subResults) {
      for (const p of products) {
        const existing = scoreMap.get(p.id);
        if (existing) existing.s += 1;
        else scoreMap.set(p.id, { p, s: 1 });
      }
    }

    const sorted = Array.from(scoreMap.values()).sort((a, b) => b.s - a.s);
    const validSubsCount = subResults.filter(r => r.length > 0).length;
    const intersection = sorted.filter(e => e.s === validSubsCount).map(e => e.p);
    return intersection.length > 0 ? intersection : sorted.map(e => e.p);
  }

  private async executeMultiQueries(queries: QueryItemObject[], root: AnalysisObject, userId: string, isGuest: boolean, pageSize: number) {
    const allProducts: any[] = [];
    const functionProducts: any[] = [];
    const taskResults: UIMessage[] = [];
    const seen = new Set<string>();

    for (const q of queries) {
      if (q.purpose === 'function' && q.functionCall) {
        if (['addToCart', 'getCart', 'clearCart', 'getOrdersByUserId'].includes(q.functionCall.name)) {
          taskResults.push(await this.executeActionTool(q.functionCall.name, q.functionCall.arguments || {}, userId, isGuest));
        } else {
          const items = await this.executeFunctionQuery(q);
          for (const p of items) { if (p.id && !seen.has(p.id)) { seen.add(p.id); functionProducts.push(p); } }
        }
      } else if (q.purpose === 'profile' && !isGuest) {
        const items = await this.executeProfileQuery(userId, q, root);
        for (const p of items) { if (p.id && !seen.has(p.id)) { seen.add(p.id); allProducts.push(this.mapToMinimalProduct(p, 'PROFILE_QUERY')); } }
      } else if (q.purpose === 'search') {
        const items = await this.executeSearchQuery(q, root);
        for (const p of items) { if (p.id && !seen.has(p.id)) { seen.add(p.id); allProducts.push(this.mapToMinimalProduct(p, 'SEARCH_QUERY')); } }
      }
    }

    let combined = [...functionProducts.map(p => this.mapToMinimalProduct(p, 'FUNCTION_RESULTS')), ...allProducts];
    if (root.budget && (root.budget.min !== null || root.budget.max !== null)) {
      const { min, max } = root.budget;
      combined = combined.map(p => ({ ...p, variants: p.variants.filter((v: any) => (min === null || v.price >= min) && (max === null || v.price <= max)) })).filter(p => p.variants.length > 0);
    }

    return { mergedProducts: combined.slice(0, pageSize), taskResults };
  }
}
