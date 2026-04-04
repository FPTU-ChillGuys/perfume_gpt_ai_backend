import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Output, UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';

import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { conversationOutput } from 'src/chatbot/output/search.output';
import { conversationSystemPrompt, INSTRUCTION_TYPE_CONVERSATION } from 'src/application/constant/prompts';
import { addMessageToMessages, convertToMessages, overrideMessagesToConversation } from 'src/infrastructure/domain/utils/message-helper';
import { buildCombinedPromptV5 } from 'src/infrastructure/domain/utils/prompt-builder';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_CONVERSATION_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { ConversationJobName, QueueName } from 'src/application/constant/processor';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { RecommendationV2Service } from 'src/infrastructure/domain/recommendation/recommendation-v2.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';

@Injectable()
export class ConversationV9Service {
  private readonly logger = new Logger(ConversationV9Service.name);

  constructor(
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE) private readonly conversationQueue: Queue,
    private readonly productService: ProductService,
    private readonly recommendationV2Service: RecommendationV2Service,
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly nlpEngineService: NlpEngineService
  ) { }

  /**
   * Xử lý luồng Chat V9 - Sử dụng NlpEngineService (local) và RecommendationV2Service 
   */
  async chatV9(
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
        { userId, conversationId: conversation.id, service: 'PromptBuilder', endpoint: 'chat/v9' }
      );
    }

    const responseConversation = await this.processAiChatResponseV9(
      convertedMessages,
      conversation.messages || [],
      conversation.id || '',
      userId,
      promptResult.data.adminInstruction,
      promptResult.data.combinedPrompt,
      'chat/v9'
    );

    return Ok(responseConversation);
  }

  private async processAiChatResponseV9(
    convertedMessages: UIMessage[],
    conversationMessages: any[],
    conversationId: string,
    userId: string,
    adminInstruction: string | undefined,
    combinedPrompt: string,
    endpoint: string
  ): Promise<ConversationDto> {
    // Phase 1: Extract Intent using AI
    const lastUserMessage = [...convertedMessages].reverse().find(m => m.role === 'user');
    const messageText = lastUserMessage?.parts.find(p => p.type === 'text')?.text || '';
    
    this.logger.log(`[processAiChatResponseV9] Analyzing intent only with AI: "${messageText.substring(0, 50)}..."`);
    
    const intentResult = await this.aiAnalysisService.analyzeIntentOnly(messageText, JSON.stringify(conversationMessages));
    let intent = intentResult?.intent || 'Chat';

    this.logger.log(`[processAiChatResponseV9] Detected Intent: ${intent}`);

    // Phase 2: Run Keyword Extraction via NLP
    // We parse NLP here so we can format it into a pseudo-AnalysisObject for Recommendation context if needed.
    const parsedNlpKw = this.nlpEngineService.parseAndNormalize(messageText);
    const nlpBrands = parsedNlpKw?.byType?.brand || [];
    const nlpProductNames = parsedNlpKw?.byType?.product_name || [];
    const nlpScents = parsedNlpKw?.byType?.scent_note || [];
    const nlpGenders = parsedNlpKw?.byType?.gender || [];
    
    // Construct a pseudo-chat context matching what Recommendation expects
    const pseudoChatContext: AnalysisObject = {
      intent: intent,
      logic: [...nlpBrands, ...nlpScents, ...nlpGenders], 
      productNames: nlpProductNames.length > 0 ? nlpProductNames : null,
      budget: null, 
      sorting: null,
      pagination: null,
      originalRequestVietnamese: messageText,
      explanation: 'NLP parsed intent and keywords',
      normalizationMetadata: null
    };

    let finalMessages = convertedMessages;

    // Phase 3: Route Actions
    if (intent === 'Recommend') {
      try {
        this.logger.log(`[processAiChatResponseV9] Invoking RecommendationV2Service for user ${userId}...`);
        const recommendationResult = await this.recommendationV2Service.getRecommendations(userId, 5, pseudoChatContext); // top 5 with context

        if (recommendationResult.success && recommendationResult.data?.recommendations?.length) {
          const minimalProducts = recommendationResult.data.recommendations.map(p => ({
            id: p.productId,
            name: p.productName,
            variantId: p.variantId,
            variantName: p.variantName,
            brand: p.brand,
            basePrice: p.basePrice,
            gender: p.gender,
            matchScore: p.score,
            scoreBreakdown: p.scoreBreakdown
          }));
          
          const resultsStr = encodeToolOutput(minimalProducts).encoded;
          
          const injectionMessage: UIMessage = {
            id: uuid(),
            role: 'system',
            parts: [{ type: 'text', text: `RECOMMENDATION_RESULTS (Personalized matches for user based on profile): ${resultsStr}` }]
          };
          finalMessages = [...convertedMessages, injectionMessage];
        }
      } catch (err) {
        this.logger.error(`[processAiChatResponseV9] Recommendation fallback failed:`, err);
      }
    } 
    else if (intent === 'Search' || intent === 'Consult') {
      try {
        this.logger.log(`[processAiChatResponseV9] Invoking Structural Search via ProductService using NLP parsing...`);
        
        // Let product service perform standard NLP search matching V8 but guided by explicit AI search intent
        const searchResponse = await this.productService.getProductsUsingParsedSearch(messageText, { PageNumber: 1, PageSize: 5, SortOrder: 'asc', IsDescending: false });

        if (searchResponse.success && searchResponse.payload?.items?.length) {
          const products = searchResponse.payload.items;
          const minimalProducts = products.map((p: any) => ({
            id: p.id,
            name: p.name,
            brand: p.brandName || p.brand,
            category: p.categoryName || p.category,
            image: p.primaryImage || p.image,
            attributes: Array.isArray(p.attributes) ? p.attributes.map((a: any) => typeof a === 'string' ? a : `${a.attribute}: ${a.value}`) : p.attributes,
            scentNotes: p.scentNotes,
            olfactoryFamilies: p.olfactoryFamilies,
            variants: Array.isArray(p.variants) ? p.variants.map((v: any) => ({ id: v.id, volume: v.volumeMl, price: v.basePrice })) : undefined
          }));
          
          const resultsStr = encodeToolOutput(minimalProducts).encoded;

          const injectionMessage: UIMessage = {
            id: uuid(),
            role: 'system',
            parts: [{ type: 'text', text: `SEARCH_RESULTS: ${resultsStr}` }]
          };
          finalMessages = [...convertedMessages, injectionMessage];
        }
      } catch (err) {
        this.logger.error(`[processAiChatResponseV9] Search fallback failed:`, err);
      }
    }

    // Phase 4: Main AI Structured Response
    const systemPrompt = conversationSystemPrompt(
      adminInstruction || '',
      combinedPrompt
    );

    this.logger.log(`[processAiChatResponseV9] Generating structured response using textGenerate...`);
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

    // Phase 5: Hydrate products if 'productTemp' exists
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

    this.logger.debug("Final message: ", finalMessageData);

    const responseConversation = overrideMessagesToConversation(
      conversationId || '',
      userId || '',
      addMessageToMessages(finalMessageData, conversationMessages || [])
    );

    // Xếp hàng lưu cuộc hội thoại
    await this.conversationQueue.add(
      ConversationJobName.ADD_MESSAGE_AND_LOG,
      { responseConversation, userId }
    );

    return responseConversation;
  }
}
