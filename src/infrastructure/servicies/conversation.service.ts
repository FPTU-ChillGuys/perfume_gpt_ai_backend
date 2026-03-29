import { UnitOfWork } from '../repositories/unit-of-work';
import { funcHandlerAsync } from '../utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Output, UIMessage } from 'ai';
import { conversationOutput, conversationOutputSchema, searchOutput } from 'src/chatbot/utils/output/search.output';
import { conversationSystemPrompt, INSTRUCTION_TYPE_CONVERSATION } from 'src/application/constant/prompts';
import { addMessageToMessages, convertToMessages, overrideMessagesToConversation } from 'src/infrastructure/utils/message-helper';
import { buildCombinedPromptV5 } from 'src/infrastructure/utils/prompt-builder';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { AIHelper } from '../helpers/ai.helper';
import { AI_CONVERSATION_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { ConversationAnalysisService } from './conversation-analysis.service';
import { ConversationJobName, QueueName } from 'src/application/constant/processor';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import { MessageDto } from 'src/application/dtos/common/message.dto';
import {
  ConversationMapper,
  MessageMapper
} from 'src/application/mapping/custom';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { PagedConversationRequest } from 'src/application/dtos/request/paged-conversation.request';
import { UserLogService } from './user-log.service';
import { ProductService } from './product.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  constructor(
    private unitOfWork: UnitOfWork,
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE) private readonly conversationQueue: Queue,
    private readonly productService: ProductService,
    private readonly analysisService: ConversationAnalysisService
  ) { }

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

        //Luu conversation
        await this.unitOfWork.AIConversationRepo.addConversation(conversation);

        //Luu message vao log (chỉ khi user đã đăng nhập)
        if (conversation.userId) {
          await this.unitOfWork.EventLogRepo.createMessageEvent(
            conversation.userId,
            conversation.messages.getItems()[conversation.messages.getItems().length - 2]
          );
          await this.userLogService.enqueueRollingSummaryUpdate(conversation.userId);
        }

        const conversationDto = ConversationMapper.toResponse(
          conversation,
          true
        );

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

        //Lay message luu vao log (chỉ khi user đã đăng nhập)
        if (conversation.userId) {
          await this.unitOfWork.EventLogRepo.createMessageEvent(
            conversation.userId,
            messages[messages.length - 2]
          );
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
        {
          id
        },
        { populate: ['messages'] }
      );
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      const conversationDto = ConversationMapper.toResponse(conversation, true);

      return { success: true, data: conversationDto };
    }, 'Failed to get conversation by id');
  }

  async isExistConversation(id: string): Promise<boolean> {
    const conversation = await this.unitOfWork.AIConversationRepo.findOne({
      id
    });
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

  /**
   * Lấy danh sách cuộc hội thoại có phân trang.
   * Hỗ trợ lọc theo userId (tùy chọn).
   */
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

  public async saveOrUpdateConversation(
    conversation: ConversationDto
  ): Promise<void> {
    if (!(await this.isExistConversation(conversation?.id ?? ''))) {
      await this.addConversation(conversation);
    } else {
      await this.updateMessageToConversation(
        conversation.id!,
        conversation.messages || []
      );
    }
  }

  private async processAiChatResponse(
    convertedMessages: UIMessage[],
    conversationMessages: any[],
    conversationId: string,
    userId: string,
    adminInstruction: string | undefined,
    combinedPrompt: string,
    endpoint: string
  ): Promise<ConversationDto> {
    // Phase 1: Intermediate Analysis
    const lastUserMessage = [...convertedMessages].reverse().find(m => m.role === 'user');
    const messageText = lastUserMessage?.parts.find(p => p.type === 'text')?.text || '';
    const previousContext = convertedMessages
      .filter(m => m !== lastUserMessage)
      .map(m => `${m.role}: ${m.parts.find(p => p.type === 'text')?.text || ''}`)
      .join('\n');

    this.logger.log(`[processAiChatResponse] Analyzing message: "${messageText.substring(0, 50)}..."`);
    const analysis = await this.analysisService.analyze(messageText, previousContext);

    let finalMessages = convertedMessages;
    let searchResultsStr = '';

    // Phase 2: Backend Search (if intent is Search or Consult)
    if (analysis && (analysis.intent === 'Search' || analysis.intent === 'Consult')) {
      this.logger.log(`[processAiChatResponse] Performing structured search for: ${analysis.explanation}`);
      const searchResponse = await this.productService.getProductsByStructuredQuery(analysis);

      if (searchResponse.success && searchResponse.data) {
        const products = searchResponse.data.items;
        const minimalProducts = products.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brandName,
          category: p.categoryName,
          attributes: p.attributes.map(a => `${a.attribute}: ${a.value}`),
          scentNotes: p.scentNotes,
          olfactoryFamilies: p.olfactoryFamilies,
          variants: p.variants.map(v => ({ id: v.id, volume: v.volumeMl, price: v.basePrice }))
        }));
        searchResultsStr = encodeToolOutput(minimalProducts).encoded;

        // Inject search results into context for Main AI
        const injectionMessage: UIMessage = {
          id: uuid(),
          role: 'system',
          parts: [{ type: 'text', text: `SEARCH_RESULTS: ${searchResultsStr}` }]
        };
        finalMessages = [...convertedMessages, injectionMessage];
      }
    }

    // Phase 3: Main AI Structured Response
    const systemPrompt = conversationSystemPrompt(
      adminInstruction || '',
      combinedPrompt
    );

    this.logger.log(`[processAiChatResponse] Generating structured response using textGenerate...`);
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

    const aiResponse = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;

    // Hydrate products if productTemp is present (ensures full object integrity for frontend)
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      const productTemp = aiResponse.productTemp;
      const ids = productTemp.map(item => item.id).filter(id => !!id);

      if (ids.length > 0) {
        const productResponse = await this.productService.getProductsByIdsForOutput(ids);
        if (productResponse.success && productResponse.data) {
          const hydratedProducts = productResponse.data;
          const recommendationsMap = new Map<string, string[]>();
          productTemp.forEach(item => {
            if (item.id && item.variants && Array.isArray(item.variants)) {
              recommendationsMap.set(item.id, item.variants.map((v: any) => v.id));
            }
          });

          aiResponse.products = hydratedProducts.map(product => {
            const recommendedVariantIds = recommendationsMap.get(product.id);
            if (recommendedVariantIds && recommendedVariantIds.length > 0) {
              const variantIdsSet = new Set(recommendedVariantIds);
              return {
                ...product,
                variants: (product.variants || []).filter(v => variantIdsSet.has(v.id))
              };
            }
            return product;
          }).filter(product => product.variants && product.variants.length > 0);
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

  /** Xử lý chat V8 (buildCombinedPromptV5 + queue_with_userid) */
  async chat(
    conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
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
        { userId, conversationId: conversation.id, service: 'PromptBuilder', endpoint: 'chat/v8' }
      );
    }

    const responseConversation = await this.processAiChatResponse(
      convertedMessages,
      conversation.messages || [],
      conversation.id || '',
      userId,
      promptResult.data.adminInstruction,
      promptResult.data.combinedPrompt,
      'chat/v8'
    );

    return Ok(responseConversation);
  }
}
