import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Output, UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';

import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { Sender } from 'src/domain/enum/sender.enum';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { conversationOutput } from 'src/chatbot/output/search.output';
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
import { ConversationJobName, QueueName } from 'src/application/constant/processor';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';

// New DTOs
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { MessageResponse } from 'src/application/dtos/response/conversation/message.response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { PagedConversationRequest } from 'src/application/dtos/request/conversation/paged-conversation.request';
import { ChatMessageRequest } from 'src/application/dtos/request/conversation/chat-message.request';

// Helpers
import { AIAnalysisHelper } from './helpers/ai-analysis.helper';
import { AIPersonalizationHelper } from './helpers/ai-personalization.helper';
import { AISearchExecutorHelper } from './helpers/ai-search-executor.helper';

/**
 * Service quản lý cuộc hội thoại giữa người dùng và AI.
 * Đã được tối ưu hóa theo Gold Standard và hợp nhất logic V10.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly unitOfWork: UnitOfWork,
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    private readonly productService: ProductService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE)
    private readonly conversationQueue: Queue,
    
    // Nâng cấp: Sử dụng Helpers để tách biệt logic
    private readonly analysisHelper: AIAnalysisHelper,
    private readonly personalizationHelper: AIPersonalizationHelper,
    private readonly searchExecutorHelper: AISearchExecutorHelper
  ) {}

  // ==========================================
  // 1. DATA ACCESS METHODS (CRUD)
  // ==========================================

  /** Lấy cuộc hội thoại theo ID */
  async getConversationById(id: string): Promise<BaseResponse<ConversationResponse>> {
    return await funcHandlerAsync(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne(
        { id },
        { populate: ['messages'] }
      );
      
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      return { success: true, data: ConversationResponse.fromEntity(conversation)! };
    }, 'Failed to get conversation');
  }

  /** Lấy tất cả cuộc hội thoại (Admin) */
  async getAllConversations(): Promise<BaseResponse<ConversationResponse[]>> {
    return await funcHandlerAsync(async () => {
      const conversations = await this.unitOfWork.AIConversationRepo.findAll({
        populate: ['messages'],
        orderBy: { updatedAt: 'DESC' }
      });

      const data = conversations.map(c => ConversationResponse.fromEntity(c)!);
      return { success: true, data };
    }, 'Failed to get conversations');
  }

  /** Lấy danh sách hội thoại có phân trang */
  async getAllConversationsPaginated(
    request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationResponse>>> {
    return await funcHandlerAsync(async () => {
      const filter = request.userId ? { userId: request.userId } : {};
      
      const pagedResult = await this.unitOfWork.AIConversationRepo.getPaged(
        request,
        filter,
        { populate: ['messages'] }
      );

      return {
        success: true,
        data: new PagedResult<ConversationResponse>({
          ...pagedResult,
          items: pagedResult.items.map(c => ConversationResponse.fromEntity(c)!)
        })
      };
    }, 'Failed to get paginated conversations');
  }

  /** Cập nhật tin nhắn vào hội thoại (dùng cho background job) */
  async updateMessageToConversation(
    id: string,
    messageRequests: ChatMessageRequest[] | any[]
  ): Promise<BaseResponse<MessageResponse[]>> {
    return await funcHandlerAsync(async () => {
      // Chuyển đổi từ DTO/Object sang entity
      const messages = messageRequests.map(req => {
        if (req instanceof ChatMessageRequest || (req.sender && req.message)) {
          const entity = new Message();
          entity.sender = req.sender;
          entity.message = typeof req.message === 'string' ? req.message : JSON.stringify(req.message);
          return entity;
        }
        return req; // Trường hợp đã là entity
      });
      
      const conversation = await this.unitOfWork.AIConversationRepo.addMessagesToConversation(
        id,
        messages
      );

      if (conversation.userId) {
        const latestMessage = messages[messages.length - 1];
        if (latestMessage) {
          await this.unitOfWork.EventLogRepo.createMessageEvent(conversation.userId, latestMessage);
        }
        await this.userLogService.enqueueRollingSummaryUpdate(conversation.userId);
      }

      const data = messages.map(m => MessageResponse.fromEntity(m)!);
      return { success: true, data };
    }, 'Failed to update messages');
  }

  /** Lưu hoặc cập nhật hội thoại (Job support) */
  public async saveOrUpdateConversation(
    conversation: any
  ): Promise<void> {
    const id = conversation?.id || '';
    const exists = await this.unitOfWork.AIConversationRepo.exists({ id });

    if (!exists) {
      const entity = new Conversation({
        id,
        userId: conversation.userId
      });
      if (conversation.messages && Array.isArray(conversation.messages)) {
        entity.messages.set(conversation.messages.map((m: any) => {
           const msg = new Message();
           msg.sender = m.sender;
           msg.message = typeof m.message === 'string' ? m.message : JSON.stringify(m.message);
           return msg;
        }));
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
   */
  async chat(request: ChatRequest): Promise<BaseResponse<ConversationResponse>> {
    const userId = request.userId ?? uuid();
    const conversationId = request.id;
    const isGuestUser = !request.userId;
    const isStaff = request.isStaff === true;

    // 1. Chuyển đổi tin nhắn sang định dạng AI UI
    const convertedMessages: UIMessage[] = convertToMessages(request.messages || []);
    const lastUserMessage = [...convertedMessages].reverse().find(m => m.role === 'user');
    const messageText = lastUserMessage?.parts.find(p => p.type === 'text')?.text || '';
    
    const previousContext = convertedMessages
      .filter(m => m !== lastUserMessage)
      .map(m => `${m.role}: ${m.parts.find(p => p.type === 'text')?.text || ''}`)
      .join('\n');

    this.logger.log(`[CHAT] Analyzing message: "${messageText.substring(0, 50)}..."`);

    // 2. Phase 1: Phân tích ý định (Intermediate Analysis)
    const analysis = await this.analysisHelper.analyze(messageText, previousContext, {
      userId,
      isGuestUser,
      isStaff
    });

    const finalMessages = [...convertedMessages];

    // 3. Phase 2: Thu thập ngữ cảnh cá nhân hóa (Personalization TOON)
    const personalizationMsgs = await this.personalizationHelper.buildPersonalizationToonMessages(
      userId,
      isGuestUser,
      analysis
    );
    finalMessages.push(...personalizationMsgs);

    // Inject kết quả phân tích vào context
    finalMessages.push({
      id: uuid(),
      role: 'system',
      parts: [{ type: 'text', text: `NORMALIZED_QUERY_ANALYSIS: ${JSON.stringify(analysis)}` }]
    });

    // 4. Phase 3: Thực thi truy vấn dữ liệu (Multi-Query Execution)
    const shouldQuery = ['Search', 'Consult', 'Recommend', 'Compare', 'Task', 'Other'].includes(analysis.intent);
    if (shouldQuery && Array.isArray(analysis.queries) && analysis.queries.length > 0) {
      const { mergedProducts, taskResults } = await this.searchExecutorHelper.executeMultiQueries(
        analysis.queries,
        analysis,
        userId,
        isGuestUser,
        analysis.pagination?.pageSize || 5
      );

      // Thêm kết quả Task (Cart/Order) và Search Results vào context
      taskResults.forEach(msg => finalMessages.push(msg));
      if (mergedProducts.length > 0) {
        finalMessages.push({
          id: uuid(),
          role: 'system',
          parts: [{ type: 'text', text: `SEARCH_RESULTS: ${encodeToolOutput(mergedProducts).encoded}` }]
        });
      }
    }

    // 5. Phase 4: Xây dựng Prompt và gọi AI chính
    const promptResult = await buildCombinedPromptV5(INSTRUCTION_TYPE_CONVERSATION, this.adminInstructionService, userId);
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
      throw new InternalServerErrorWithDetailsException('Failed to generate AI response', { userId, conversationId });
    }

    const aiResponse = typeof aiResult.data === 'string' ? JSON.parse(aiResult.data) : aiResult.data;

    // 6. Hydrate Products (Lấy thông tin đầy đủ cho frontend)
    await this.hydrateProductsInResponse(aiResponse);

    // 7. Lưu trữ và Logging (Background Queue)
    const finalMessageData = JSON.stringify(aiResponse);
    const responseConversation = overrideMessagesToConversation(
      conversationId,
      userId,
      addMessageToMessages(finalMessageData, (request.messages || []) as any)
    );

    await this.conversationQueue.add(ConversationJobName.ADD_MESSAGE_AND_LOG, { 
      responseConversation, 
      userId 
    });

    // Mapping sang ConversationResponse
    const response = new ConversationResponse();
    response.id = responseConversation.id || conversationId;
    response.userId = responseConversation.userId || userId;
    response.updatedAt = new Date();
    response.messages = (responseConversation.messages || []).map(m => {
       const res = new MessageResponse();
       res.sender = m.sender as Sender;
       res.message = m.message;
       res.createdAt = new Date();
       return res;
    });

    return Ok(response);
  }

  /** Hỗ trợ lấy thông tin sản phẩm đầy đủ cho AI response */
  private async hydrateProductsInResponse(aiResponse: any): Promise<void> {
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      const ids = aiResponse.productTemp.map((p: any) => p.id).filter((id: any) => !!id);
      if (ids.length > 0) {
        const productRes = await this.productService.getProductsByIdsForOutput(ids);
        if (productRes.success && productRes.data) {
          aiResponse.products = productRes.data;
        }
      }
    }
  }
}
