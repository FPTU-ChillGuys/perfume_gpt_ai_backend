import { Inject, Injectable, Logger } from '@nestjs/common';
import { Output, UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';

import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { Sender } from 'src/domain/enum/sender.enum';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { conversationOutput } from 'src/chatbot/output/search.output';
import {
  conversationSystemPrompt,
  INSTRUCTION_TYPE_CONVERSATION
} from 'src/application/constant/prompts';
import { convertToMessages } from 'src/infrastructure/domain/utils/message-helper';
import { buildCombinedPromptV5 } from 'src/infrastructure/domain/utils/prompt-builder';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_CONVERSATION_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { UserService } from 'src/infrastructure/domain/user/user.service';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';

// DTOs
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { MessageResponse } from 'src/application/dtos/response/conversation/message.response';
import {
  ChatV11Response,
  ChatV11AiMessage
} from 'src/application/dtos/response/conversation/chat-v11.response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { PagedConversationRequest } from 'src/application/dtos/request/conversation/paged-conversation.request';
import { ChatMessageRequest } from 'src/application/dtos/request/conversation/chat-message.request';

// Helpers
import { AIAnalysisHelper } from './helpers/ai-analysis.helper';
import { AIPersonalizationHelper } from './helpers/ai-personalization.helper';
import { AISearchExecutorHelper } from './helpers/ai-search-executor.helper';
import { ConversationResponseBuilder } from './helpers/conversation-response.builder';
import { NlpQueryMapper } from './helpers/nlp-query-mapper.helper';

/**
 * Service quản lý cuộc hội thoại giữa người dùng và AI.
 * Đã được tối ưu hóa theo Gold Standard và hợp nhất logic V10.
 */
@Injectable()
export class ConversationService {
  private static readonly UUID_REGEX =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    private readonly productService: ProductService,
    private readonly userService: UserService,

    // Helpers
    private readonly analysisHelper: AIAnalysisHelper,
    private readonly personalizationHelper: AIPersonalizationHelper,
    private readonly searchExecutorHelper: AISearchExecutorHelper,
    private readonly responseBuilder: ConversationResponseBuilder,
    private readonly nlpQueryMapper: NlpQueryMapper,
    private readonly err: I18nErrorHandler
  ) {}

  // ==========================================
  // 1. DATA ACCESS METHODS (CRUD)
  // ==========================================

  /** Lấy cuộc hội thoại theo ID */
  async getConversationById(
    id: string
  ): Promise<BaseResponse<ConversationResponse>> {
    return this.err.wrap(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne(
        { id },
        { populate: ['messages'] }
      );

      if (!conversation) {
        return this.err.fail('errors.conversation.not_found');
      }

      const response = ConversationResponse.fromEntity(conversation)!;
      await this.resolveUserNameForConversation(response);

      return { success: true, data: response };
    }, 'errors.conversation.get_by_id');
  }

  /** Lấy tất cả cuộc hội thoại (Admin) */
  async getAllConversations(): Promise<BaseResponse<ConversationResponse[]>> {
    return this.err.wrap(async () => {
      const conversations = await this.unitOfWork.AIConversationRepo.findAll({
        populate: ['messages'],
        orderBy: { updatedAt: 'DESC' }
      });

      const data = conversations.map(
        (c) => ConversationResponse.fromEntity(c)!
      );
      await this.resolveUserNameForConversations(data);

      return { success: true, data };
    }, 'errors.conversation.get_all');
  }

  /** Lấy danh sách hội thoại có phân trang */
  async getAllConversationsPaginated(
    request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationResponse>>> {
    return this.err.wrap(async () => {
      const filter = request.userId ? { userId: request.userId } : {};

      const pagedResult = await this.unitOfWork.AIConversationRepo.getPaged(
        request,
        filter,
        { populate: ['messages'] }
      );

      const items = pagedResult.items
        .map((c) => ConversationResponse.fromEntity(c)!)
        .reverse();

      await this.resolveUserNameForConversations(items);

      return {
        success: true,
        data: new PagedResult<ConversationResponse>({
          ...pagedResult,
          items
        })
      };
    }, 'errors.conversation.get_paginated');
  }

  /** Cập nhật tin nhắn vào hội thoại */
  async updateMessageToConversation(
    id: string,
    messageRequests: ChatMessageRequest[]
  ): Promise<BaseResponse<MessageResponse[]>> {
    return this.err.wrap(async () => {
      const messages = messageRequests.map((req) => req.toEntity());

      const conversation =
        await this.unitOfWork.AIConversationRepo.addMessagesToConversation(
          id,
          messages
        );

      if (conversation.userId) {
        const latestMessage = messages[messages.length - 1];
        if (latestMessage) {
          await this.unitOfWork.EventLogRepo.createMessageEvent(
            conversation.userId,
            latestMessage
          );
        }
        await this.userLogService.enqueueRollingSummaryUpdate(
          conversation.userId
        );
      }

      const data = messages.map((m) => MessageResponse.fromEntity(m)!);
      return { success: true, data };
    }, 'errors.conversation.update_messages');
  }

  /** Lưu hoặc cập nhật hội thoại trực tiếp */
  public async saveOrUpdateConversation(
    conversation: ChatRequest
  ): Promise<void> {
    const id = conversation.id || '';
    const exists = await this.unitOfWork.AIConversationRepo.exists({ id });

    if (!exists) {
      const entity = new Conversation({
        id,
        userId: conversation.userId
      });
      if (conversation.messages && Array.isArray(conversation.messages)) {
        entity.messages.set(conversation.messages.map((m) => m.toEntity()));
      }
      await this.unitOfWork.AIConversationRepo.addAndFlush(entity);
    } else {
      await this.updateMessageToConversation(id, conversation.messages || []);
    }
  }

  // ==========================================
  // 2. CORE CHAT LOGIC (V10 COMBINED)
  // ==========================================

  /**
   * Phương thức Chat chính (Advanced AI flow).
   * Được tách thành các private methods theo phase để dễ maintain.
   */
  async chat(
    request: ChatRequest
  ): Promise<BaseResponse<ConversationResponse>> {
    const context = await this.buildChatContext(request);
    this.logger.log(
      `[CHAT] Analyzing message: "${context.messageText.substring(0, 50)}..."`
    );

    // Phase 1: Phân tích ý định
    const analysis = await this.analysisHelper.analyze(
      context.messageText,
      context.previousContext,
      {
        userId: context.userId,
        isGuestUser: context.isGuestUser,
        isStaff: context.isStaff
      }
    );

    // Phase 2-4: Xây dựng context messages
    const finalMessages = await this.buildContextMessages(context, analysis);

    // Phase 5: Gọi AI chính
    const aiResponse = await this.executeAIGeneration(finalMessages, context);

    // Sanitize variant IDs leak from AI message
    this.sanitizeVariantIdsFromMessage(aiResponse);

    // Phase 6: Hydrate products
    await this.hydrateProductsInResponse(aiResponse, analysis.budget);

    return this.buildResponseOnly(aiResponse, context, request);
  }

  // ==========================================
  // 2b. V11 — Chat with individual message persistence
  // ==========================================

  async chatV11(request: ChatRequest): Promise<BaseResponse<ChatV11Response>> {
    const context = await this.buildChatContext(request);
    this.logger.log(
      `[CHAT-V11] Analyzing message: "${context.messageText.substring(0, 50)}..."`
    );

    const analysis = await this.analysisHelper.analyze(
      context.messageText,
      context.previousContext,
      {
        userId: context.userId,
        isGuestUser: context.isGuestUser,
        isStaff: context.isStaff
      }
    );

    const finalMessages = await this.
    buildContextMessages(context, analysis);

    const aiResponse = await this.executeAIGeneration(finalMessages, context);

    // Sanitize variant IDs leak from AI message
    this.sanitizeVariantIdsFromMessage(aiResponse);

    await this.hydrateProductsInResponse(aiResponse, analysis.budget);

    const userMessageText = context.messageText;
    const userMsg = new Message();
    userMsg.sender = Sender.USER;
    userMsg.message = userMessageText;
    const savedUserMsg =
      await this.unitOfWork.AIConversationRepo.addSingleMessage(
        context.conversationId,
        context.userId,
        userMsg
      );

    const aiMessageText =
      typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
    const aiMsg = new Message();
    aiMsg.sender = Sender.ASSISTANT;
    aiMsg.message = aiMessageText;
    const savedAiMsg =
      await this.unitOfWork.AIConversationRepo.addSingleMessage(
        context.conversationId,
        context.userId,
        aiMsg
      );

    if (context.userId) {
      await this.unitOfWork.EventLogRepo.createMessageEvent(
        context.userId,
        savedAiMsg
      );
      await this.userLogService.enqueueRollingSummaryUpdate(context.userId);
    }

    const response = new ChatV11Response();
    response.conversationId = context.conversationId;
    response.aiMessage = new ChatV11AiMessage();
    response.aiMessage.sender = savedAiMsg.sender;
    response.aiMessage.message = savedAiMsg.message;
    response.aiMessage.createdAt = savedAiMsg.createdAt;

    return { success: true, data: response };
  }

  // ==========================================
  // 3. PRIVATE METHODS — Chat Pipeline Steps
  // ==========================================

  /** Xây dựng ChatContext từ request */
  private async buildChatContext(request: ChatRequest) {
    const userId = request.userId ?? uuid();
    const conversationId = request.id;
    let isGuestUser = !request.userId;
    if (request.userId) {
      const userExists = await this.userService.isUserExistedByUserId(request.userId);
      isGuestUser = !userExists.payload;
    }
    const isStaff = request.isStaff === true;

    const convertedMessages: UIMessage[] = convertToMessages(
      request.messages || []
    );
    const lastUserMessage = [...convertedMessages]
      .reverse()
      .find((m) => m.role === 'user');
    const messageText =
      lastUserMessage?.parts.find((p) => p.type === 'text')?.text || '';

    const previousContext = convertedMessages
      .filter((m) => m !== lastUserMessage)
      .map(
        (m) =>
          `${m.role}: ${m.parts.find((p) => p.type === 'text')?.text || ''}`
      )
      .join('\n');

    return {
      userId,
      conversationId,
      isGuestUser,
      isStaff,
      convertedMessages,
      messageText,
      previousContext
    };
  }

  /** Xây dựng danh sách messages cho AI (Phase 2-4) */
  private async buildContextMessages(
    context: {
      convertedMessages: UIMessage[];
      userId: string;
      isGuestUser: boolean;
    },
    analysis: any
  ): Promise<UIMessage[]> {
    const finalMessages = [...context.convertedMessages];

    // Phase 2: Personalization TOON
    const personalizationMsgs =
      await this.personalizationHelper.buildPersonalizationToonMessages(
        context.userId,
        context.isGuestUser,
        analysis
      );
    finalMessages.push(...personalizationMsgs);

    this.logger.log(
      `[Conversation] Analysis details: intent=${analysis.intent}, ` +
        `logic=${JSON.stringify(analysis.logic)}, ` +
        `queries=${JSON.stringify(analysis.queries?.map((q) => ({ logic: q.logic, budget: q.budget, productNames: q.productNames })))}, ` +
        `productNames=${JSON.stringify(analysis.productNames)}, ` +
        `budget=${JSON.stringify(analysis.budget)}, ` +
        `gender=${JSON.stringify(analysis.gender)}, ` +
        `genderValues=${JSON.stringify(analysis.genderValues)}, ` +
        `normalizationMetadata=${JSON.stringify(analysis.normalizationMetadata?.slice(0, 10))}`
    );

    // Inject kết quả phân tích vào context
    finalMessages.push(
      this.responseBuilder.createSystemMessage(
        `NORMALIZED_QUERY_ANALYSIS: ${JSON.stringify(analysis)}`
      )
    );

    // Inject guest user notice so AI knows not to attempt cart operations
    if (context.isGuestUser) {
      finalMessages.push(
        this.responseBuilder.createSystemMessage(
          'GUEST_USER_NOTICE: Người dùng chưa đăng nhập. KHÔNG gọi tool addToCart. Nếu người dùng yêu cầu thêm vào giỏ hàng, lịch sự nhắc họ đăng nhập.'
        )
      );
    }

    // Phase 3: Thực thi truy vấn dữ liệu (Multi-Query Execution)
    const shouldQuery = [
      'Search',
      'Consult',
      'Recommend',
      'Compare',
      'Task',
      'Other'
    ].includes(analysis.intent);

    let effectiveQueries = analysis.queries;

    // NLP fallback: if AI has no queries but intent is search-related, use NLP
    if (
      shouldQuery &&
      (!Array.isArray(effectiveQueries) || effectiveQueries.length === 0)
    ) {
      const nlpQueries = this.nlpQueryMapper.mapToQueries(
        analysis.originalRequestVietnamese || '',
        analysis.intent
      );
      if (nlpQueries && nlpQueries.length > 0) {
        this.logger.log(
          `[Conversation] AI queries empty for intent="${analysis.intent}", using NLP fallback`
        );
        effectiveQueries = nlpQueries;
      }
    } else if (
      shouldQuery &&
      Array.isArray(effectiveQueries) &&
      effectiveQueries.length > 0
    ) {
      // OR-merge: combine AI queries with NLP results
      const nlpQueries = this.nlpQueryMapper.mapToQueries(
        analysis.originalRequestVietnamese || '',
        analysis.intent
      );
      if (nlpQueries && nlpQueries.length > 0) {
        effectiveQueries = this.nlpQueryMapper.mergeQueries(
          effectiveQueries,
          nlpQueries
        );
      }
    }

    // Tertiary fallback: if both AI and NLP yielded nothing, but analysis has productNames or logic
    if (
      shouldQuery &&
      (!Array.isArray(effectiveQueries) || effectiveQueries.length === 0) &&
      (analysis.productNames?.length > 0 || analysis.logic?.length > 0)
    ) {
      const fallbackLogic: (string | string[])[] = [];

      if (analysis.productNames?.length > 0) {
        for (const name of analysis.productNames) {
          fallbackLogic.push(name);
        }
      }

      if (analysis.logic?.length > 0) {
        for (const group of analysis.logic) {
          if (group) fallbackLogic.push(group);
        }
      }

      if (fallbackLogic.length > 0) {
        this.logger.log(
          `[Conversation] AI+NLP yielded no queries, building fallback from analysis data: ${JSON.stringify(fallbackLogic)}`
        );
        effectiveQueries = [
          {
            purpose: 'search',
            logic: fallbackLogic,
            productNames: analysis.productNames || null,
            sorting: analysis.sorting || null,
            budget: analysis.budget || null,
            functionCall: null,
            profileHint: null
          }
        ];
      }
    }

    if (
      shouldQuery &&
      Array.isArray(effectiveQueries) &&
      effectiveQueries.length > 0
    ) {
      const { mergedProducts, taskResults } =
        await this.searchExecutorHelper.executeMultiQueries(
          effectiveQueries,
          analysis,
          context.userId,
          context.isGuestUser,
          analysis.pagination?.pageSize || 15
        );

      taskResults.forEach((msg) => finalMessages.push(msg));
      if (mergedProducts.length > 0) {
        finalMessages.push(
          this.responseBuilder.createSystemMessage(
            `SEARCH_RESULTS: ${encodeToolOutput(mergedProducts).encoded}`
          )
        );
      }
    }

    return finalMessages;
  }

  /** Phase 5: Gọi AI chính và parse response */
  private async executeAIGeneration(
    finalMessages: UIMessage[],
    context: { userId: string; conversationId: string }
  ): Promise<any> {
    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_CONVERSATION,
      this.adminInstructionService,
      context.userId
    );
    const systemPrompt = conversationSystemPrompt(
      promptResult.data?.adminInstruction || '',
      promptResult.data?.combinedPrompt || ''
    );

    const aiResult = await this.aiHelper.textGenerateFromMessages(
      finalMessages,
      systemPrompt,
      Output.object(conversationOutput)
    );

    if (!aiResult.success || !aiResult.data) {
      this.err.throw(
        'errors.conversation.chat',
        InternalServerErrorWithDetailsException,
        {
          userId: context.userId,
          conversationId: context.conversationId
        }
      );
    }

    return typeof aiResult.data === 'string'
      ? JSON.parse(aiResult.data)
      : aiResult.data;
  }

  /** Build response only (V10 — no DB persistence) */
  private buildResponseOnly(
    aiResponse: any,
    context: { userId: string; conversationId: string },
    request: ChatRequest
  ): BaseResponse<ConversationResponse> {
    const responseConversation = this.responseBuilder.buildConversationForSave(
      context.conversationId,
      context.userId,
      aiResponse,
      request.messages || []
    );

    return this.responseBuilder.buildChatResponse(
      responseConversation,
      context.conversationId,
      context.userId
    );
  }

  /** Hỗ trợ lấy thông tin sản phẩm đầy đủ cho AI response */
  private async hydrateProductsInResponse(
    aiResponse: any,
    budget?: any
  ): Promise<void> {
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      const ids = aiResponse.productTemp
        .map((p: any) => p.id)
        .filter(
          (id: any) => !!id && ConversationService.UUID_REGEX.test(String(id))
        );
      if (ids.length > 0) {
        try {
          const productRes =
            await this.productService.getProductsByIdsForOutput(ids);
          if (productRes.success && productRes.data) {
            let hydratedProducts = productRes.data;

            if (
              budget &&
              (budget.min !== undefined || budget.max !== undefined)
            ) {
              const min = budget.min ? Number(budget.min) : 0;
              const max = budget.max ? Number(budget.max) : Infinity;

              hydratedProducts = hydratedProducts
                .map((product: any) => {
                  const filteredVariants = (product.variants || []).filter(
                    (v: any) => {
                      const price = Number(v.basePrice);
                      return price >= min && price <= max;
                    }
                  );
                  return { ...product, variants: filteredVariants };
                })
                .filter((product: any) => product.variants.length > 0);

              this.logger.log(
                `[HYDRATE] Budget filter applied: ${min}-${max === Infinity ? '∞' : max}. ` +
                  `Products: ${productRes.data.length} → ${hydratedProducts.length}`
              );
            }

            aiResponse.products = hydratedProducts;
          }
        } catch (error) {
          this.logger.warn(
            `[HYDRATE] Failed to hydrate products: ${(error as Error).message}`
          );
        }
      }
    }
  }

  /** Strip variant UUIDs leaked into AI response message text */
  private sanitizeVariantIdsFromMessage(aiResponse: any): void {
    if (!aiResponse?.message || typeof aiResponse.message !== 'string') return;

    const UUID_PATTERN =
      /\b(variantId|variant_id|biến thể)\s*[:：]?\s*[0-9a-f]{8}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{12}\b/gi;

    let sanitized = aiResponse.message.replace(UUID_PATTERN, '');

    // Also catch bare UUIDs that might appear standalone in error messages
    const BARE_UUID = /\b[0-9a-f]{8}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{12}\b/gi;
    sanitized = sanitized.replace(BARE_UUID, '');

    // Clean up double spaces / empty parentheses left from removal
    sanitized = sanitized.replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim();

    if (sanitized !== aiResponse.message) {
      this.logger.log('[SANITIZE] Removed variant UUIDs from AI message');
      aiResponse.message = sanitized;
    }
  }

  private async resolveUserNameForConversation(
    response: ConversationResponse
  ): Promise<void> {
    if (!response.userId) {
      response.userName = 'Khách';
      return;
    }

    const userNameMap = await this.userService.resolveUserNames([
      response.userId
    ]);
    response.userName = userNameMap.get(response.userId) || 'Khách';
  }

  private async resolveUserNameForConversations(
    responses: ConversationResponse[]
  ): Promise<void> {
    if (responses.length === 0) return;

    const userNameMap = await this.userService.resolveUserNames(
      responses.map((r) => r.userId).filter((id): id is string => !!id)
    );

    for (const resp of responses) {
      resp.userName = userNameMap.get(resp.userId) || 'Khách';
    }
  }
}
