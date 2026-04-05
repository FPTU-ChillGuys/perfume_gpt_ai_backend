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
import { RecommendationV3Service } from 'src/infrastructure/domain/recommendation/recommendation-v3.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConversationV9Service {
  private readonly logger = new Logger(ConversationV9Service.name);

  constructor(
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE) private readonly conversationQueue: Queue,
    private readonly productService: ProductService,
    private readonly recommendationV3Service: RecommendationV3Service,
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly nlpEngineService: NlpEngineService
  ) { }

  /**
   * Xử lý luồng Chat V9 - Sử dụng NlpEngineService (local) và RecommendationV3Service 
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
    
    // --- Khởi tạo log ghi ra file ở đây ---
    const debugTraceSessionId = uuid();
    const traceLogs: string[] = [
      `\n======================================================`,
      `[REQ_ID: ${debugTraceSessionId}] - TIME: ${new Date().toISOString()}`,
      `[USER_MESSAGE]: ${messageText}`
    ];
    
    this.logger.log(`[processAiChatResponseV9] Analyzing intent only with AI: "${messageText.substring(0, 50)}..."`);
    
    const intentResult = await this.aiAnalysisService.analyzeIntentOnly(messageText, JSON.stringify(conversationMessages));
    let intent = intentResult?.intent || 'Chat';

    traceLogs.push(`[AI_ANALYSIS_INTENT]: ${intent}`);
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

    traceLogs.push(`[NLP_EXTRACTED_KEYWORDS]: Brands=${nlpBrands.join(',') || 'none'}, Scents=${nlpScents.join(',') || 'none'}, Genders=${nlpGenders.join(',') || 'none'}`);

    let finalMessages = convertedMessages;

    // Phase 3: Route Actions
    if (intent === 'Recommend') {
      try {
        this.logger.log(`[processAiChatResponseV9] Invoking RecommendationV3Service for user ${userId}...`);
        
        const recommendInputStr = `intent=${intent}; brands=${nlpBrands.slice(0, 10).join('|') || 'none'}; scents=${nlpScents.slice(0, 10).join('|') || 'none'}; genders=${nlpGenders.slice(0, 10).join('|') || 'none'}; productNames=${nlpProductNames.slice(0, 10).join('|') || 'none'}`;
        this.logger.log(`[processAiChatResponseV9] [RECOMMEND_INPUT] ${recommendInputStr}`);
        traceLogs.push(`[RECOMMEND_INPUT]: ${recommendInputStr}`);

        // --- NEW: DYNAMIC WEIGHTS LOGIC (Hybrid Rule-based) ---
        const lowerMsg = messageText.toLowerCase();
        let targetWeights = { brand: 0.25, scent: 0.40, survey: 0.10, season: 0.12, age: 0.08, budget: 0.05 };
        let activeMode = 'default';

        if (lowerMsg.includes('giá') || lowerMsg.includes('tiền') || lowerMsg.includes('tầm') || lowerMsg.includes('khoảng') || lowerMsg.includes('ngân sách') || lowerMsg.includes('rẻ') || lowerMsg.includes('đắt') || lowerMsg.includes('triệu') || lowerMsg.includes('k ')) {
          targetWeights = { budget: 0.50, brand: 0.10, scent: 0.10, survey: 0.10, season: 0.10, age: 0.10 };
          activeMode = 'budget_focus';
        } else if (lowerMsg.includes('mùa') || lowerMsg.includes('nóng') || lowerMsg.includes('lạnh') || lowerMsg.includes('hè') || lowerMsg.includes('đông') || lowerMsg.includes('thu') || lowerMsg.includes('xuân') || lowerMsg.includes('thời tiết')) {
          targetWeights = { season: 0.40, scent: 0.25, brand: 0.15, survey: 0.10, age: 0.05, budget: 0.05 };
          activeMode = 'season_focus';
        } else if (lowerMsg.includes('giống') || lowerMsg.includes('tương tự') || lowerMsg.includes('như chai') || lowerMsg.includes('cùng loại')) {
          targetWeights = { brand: 0.40, scent: 0.40, survey: 0.05, season: 0.05, age: 0.05, budget: 0.05 };
          activeMode = 'similar_focus';
        }
        
        traceLogs.push(`[RECOMMEND_DYNAMIC_WEIGHTS]: Mode=${activeMode}, Weights=${JSON.stringify(targetWeights)}`);
        this.logger.log(`[processAiChatResponseV9] Applied Dynamic Weight: Mode=${activeMode} | Weights=${JSON.stringify(targetWeights)}`);

        const recommendationResult = await this.recommendationV3Service.getRecommendations(userId, 1, pseudoChatContext, targetWeights); // Top 1 with dynamic weights

        if (recommendationResult.success && recommendationResult.data?.recommendations?.length) {
          const profile = recommendationResult.data.profile;
          if (profile) {
            traceLogs.push(`[RECOMMEND_PROFILE_USED]: Mode=Simple_V3, Age=${profile.age}, BudgetRange=${profile.budgetRange?.[0]}-${profile.budgetRange?.[1]}`);
            traceLogs.push(`[RECOMMEND_PROFILE_PREFS]: Brands=[${profile.topBrands?.join(', ') || 'N/A'}], Scents=[${profile.topScents?.join(', ') || 'N/A'}]`);
          }

          traceLogs.push(`[RECOMMEND_SYSTEM_RESULT]: Returned ${recommendationResult.data.recommendations.length} items`);
          recommendationResult.data.recommendations.forEach((rec, idx) => {
            const br = rec.scoreBreakdown;
            let scoreStr = `(Score: ${rec.score.toFixed(2)})`;
            if (br) {
               scoreStr += ` -> Breakdown [Brand: ${(br.brandScore * 100).toFixed(0)}%, Scent: ${(br.scentScore * 100).toFixed(0)}%, Season: ${(br.seasonScore * 100).toFixed(0)}%, Budget: ${(br.budgetScore * 100).toFixed(0)}%]`;
            }
            traceLogs.push(`   -> Rank ${idx + 1}: ${rec.productName} ${scoreStr}`);
          });

          const minimalProducts = recommendationResult.data.recommendations.map(p => ({
            id: p.productId,
            name: p.productName,
            variantId: p.variantId,
            variantName: p.variantName,
            brand: p.brand,
            basePrice: p.basePrice,
            gender: p.gender,
            source: 'RECOMMENDATION_RESULTS', // Thêm trường source để AI biết
            attributes: [
              ...(Array.isArray(p.scentNotes) ? p.scentNotes.map(note => `Scent: ${note}`) : []),
              ...(Array.isArray(p.olfactoryFamilies) ? p.olfactoryFamilies.map(f => `Family: ${f}`) : [])
            ],
            scentNotes: p.scentNotes,
            olfactoryFamilies: p.olfactoryFamilies,
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
        const searchResponse = await this.productService.getProductsUsingParsedSearch(messageText, { PageNumber: 1, PageSize: 1, SortOrder: 'asc', IsDescending: false }); // Chỉ lấy 1 sản phẩm

        if (searchResponse.success && searchResponse.payload?.items?.length) {
          const products = searchResponse.payload.items;
          const minimalProducts = products.map((p: any) => ({
            id: p.id,
            name: p.name,
            brand: p.brandName || p.brand,
            category: p.categoryName || p.category,
            source: 'SEARCH_RESULTS', // Thêm trường source để nhắc AI
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
          traceLogs.push(`[SEARCH_SYSTEM_RESULT]: Returned ${products.length} products`);
        }
      } catch (err: any) {
        this.logger.error(`[processAiChatResponseV9] Search fallback failed:`, err);
        traceLogs.push(`[SEARCH_SYSTEM_ERROR]: ${err.message}`);
      }
    }

    // Phase 4: Main AI Structured Response
    const systemPrompt = conversationSystemPrompt(
      adminInstruction || '',
      combinedPrompt
    );

    traceLogs.push(`[AI_FINAL_GENERATION]: Starting text generation...`);
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
          const tempMetaMap = new Map<string, any>();
          
          productTemp.forEach((item: any) => {
            if (item.id && item.variants && Array.isArray(item.variants)) {
              recommendationsMap.set(item.id, item.variants.map((v: any) => v.id));
            }
            if (item.id) {
              tempMetaMap.set(item.id, { reasoning: item.reasoning, source: item.source });
            }
          });

          aiResponse.products = hydratedProducts.map(product => {
            const recommendedVariantIds = recommendationsMap.get(product.id);
            const metaInfo = tempMetaMap.get(product.id);
            
            if (recommendedVariantIds && recommendedVariantIds.length > 0) {
              const variantIdsSet = new Set(recommendedVariantIds);
              return {
                ...product,
                variants: (product.variants || []).filter(v => variantIdsSet.has(v.id)),
                reasoning: metaInfo?.reasoning,
                source: metaInfo?.source
              };
            }
            return {
              ...product,
              reasoning: metaInfo?.reasoning,
              source: metaInfo?.source
            };
          }).filter(product => product.variants && product.variants.length > 0);

          // Log AI reasoning for products side-by-side with original source context
          aiResponse.products.forEach((p: any) => {
            const displayLog = `\n=== 🤖 AI GỢI Ý & GIẢI THÍCH ===\n✨ Tên sản phẩm: ${p.name}\n🔍 Nguồn dữ liệu: ${p.source || 'N/A'}\n🧠 Lý do (AI phân tích): ${p.reasoning || 'Không có'}\n================================`;
            this.logger.log(displayLog);
            traceLogs.push(`[AI_FINAL_RECOMMEND_REASONING]: ${p.name} | ${p.source || 'N/A'} | ${p.reasoning}`);
          });
        }
      }
    }

    const finalMessageData = JSON.stringify(aiResponse);
    traceLogs.push(`[AI_FINAL_MESSAGE]: ${aiResponse.message?.substring(0, 100)}...`);

    // Lưu file log chuyên biệt
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'ai_recommendation_trace.txt'), traceLogs.join('\n') + '\n\n', 'utf8');
    } catch (fileErr) {
      this.logger.error('Could not write trace log file', fileErr);
    }

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
