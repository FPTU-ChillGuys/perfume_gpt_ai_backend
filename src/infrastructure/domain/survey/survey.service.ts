import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { Mapper } from '@automapper/core';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SurveyQuestionResponse } from 'src/application/dtos/response/survey-question.response';
import {
  SurveyQuestionAnswerMapper,
  SurveyQuestionMapper
} from 'src/application/mapping';
import { SurveyQuesAnwsRequest } from 'src/application/dtos/request/survey-ques-ans.request';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';
import { Output } from 'ai';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName, SurveyJobName } from 'src/application/constant/processor';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_HELPER, AI_SURVEY_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { surveyContextPrompt, surveyProductContextPrompt, surveyPrompt, surveyRecommendationSystemPrompt } from 'src/application/constant/prompts';
import { SurveyQuestionAnswer } from 'src/domain/entities/survey-question-answer.entity';
import { INSTRUCTION_TYPE_SURVEY } from 'src/application/constant/prompts/admin-instruction-types';
import { conversationOutput, searchOutput, surveyOutput } from 'src/chatbot/output/search.output';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { v4 as uuidv4 } from 'uuid';
import { mergeSurveyQueryResults, SurveyQueryResult } from 'src/infrastructure/domain/survey/survey-merge.util';


@Injectable()
export class SurveyService {

  private readonly logger = new Logger(SurveyService.name);

  constructor(
    private unitOfWork: UnitOfWork,
    @Inject(AI_SURVEY_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    @InjectQueue(QueueName.SURVEY_QUEUE) private readonly surveyQueue: Queue,
    private readonly productService: ProductService,
    private readonly analysisService: AiAnalysisService,
    private readonly aiAcceptanceService: AIAcceptanceService
  ) { }

  async addSurveyQues(
    question: SurveyQuestionRequest
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const surveyQuestion =
          await this.unitOfWork.AISurveyQuestionRepo.createWithAnswers(question);
        return { success: true, data: surveyQuestion.id };
      },
      'Failed to add survey question and answers',
      true
    );
  }

  async updateAnswer(
    id: string,
    request: SurveyQuestionRequest
  ): Promise<BaseResponse<SurveyQuestionResponse>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestion = await this.unitOfWork.AISurveyQuestionRepo.findOne({
        id,
        isActive: true
      });

      if (!surveyQuestion) {
        return { success: false, error: 'Survey question not found' };
      }

      // Cập nhật questionType nếu có
      if (request.questionType !== undefined) {
        surveyQuestion.questionType = request.questionType;
      }

      const updatedSurveyQuestion =
        await this.unitOfWork.AISurveyQuestionRepo.updateWithAnswers(
          surveyQuestion,
          request.answers
        );

      return {
        success: true,
        data: SurveyQuestionMapper.toResponse(updatedSurveyQuestion)
      };
    }, 'Failed to update survey answer', true);
  }

  async getSurveyQuesById(
    id: string
  ): Promise<BaseResponse<SurveyQuestionResponse>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestion = await this.unitOfWork.AISurveyQuestionRepo.findOne(
        {
          id,
          isActive: true
        },
        { populate: ['answers'] }
      );
      if (!surveyQuestion) {
        return { success: false, error: 'Survey question not found' };
      }

      const surveyQuestionResponse = SurveyQuestionMapper.toResponse(surveyQuestion, true);

      return { success: true, data: surveyQuestionResponse };
    }, 'Failed to get survey question by id');
  }

  async getSurveyQuesByIdList(
    ids: string[]
  ): Promise<BaseResponse<SurveyQuestionResponse[]>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestions = await this.unitOfWork.AISurveyQuestionRepo.find(
        { id: { $in: ids }, isActive: true },
        { populate: ['answers'] }
      );
      const surveyQuestionsResponses =
        SurveyQuestionMapper.toResponseList(surveyQuestions, true);
      return { success: true, data: surveyQuestionsResponses };
    }, 'Failed to get survey questions by id list');
  }

  async getAllSurveyQues(): Promise<BaseResponse<SurveyQuestionResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const surveyQuestions = await this.unitOfWork.AISurveyQuestionRepo.find(
          { isActive: true },
          { populate: ['answers'], orderBy: { updatedAt: 'DESC' } }
        );

        const surveyQuestionsResponses =
          SurveyQuestionMapper.toResponseList(surveyQuestions, true);

        return { success: true, data: surveyQuestionsResponses };
      },
      'Failed to get all survey questions',
      true
    );
  }

  async addSurveyQuesAnws(
    surveyQuesAnws: SurveyQuesAnwsRequest
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const quesAns = await this.mappingFromRequestToEntity(surveyQuesAnws);

      const surveyQuestionAnswer =
        await this.unitOfWork.AISurveyQuestionAnswerRepo.createQuesAns(quesAns);

      const logUserId = surveyQuesAnws.userId ?? uuidv4();

      //Log last survey question answer
      const surveyEventIds = await this.unitOfWork.EventLogRepo.createSurveyEventsFromDetails(
        logUserId,
        surveyQuestionAnswer.details.getItems()
      );

      if (surveyEventIds.length) {
        await this.userLogService.enqueueRollingSummaryUpdate(logUserId);
      }

      const savedQuesAns = SurveyQuestionAnswerMapper.toResponse(
        surveyQuestionAnswer,
        true
      );

      return { success: true, data: savedQuesAns };
    }, 'Failed to add survey question answer', true);
  }

  async getAllSurveyQuesAnws(): Promise<
    BaseResponse<SurveyQuestionAnswerResponse[]>
  > {
    return await funcHandlerAsync(async () => {
      const surveyQuestionAnswers =
        await this.unitOfWork.AISurveyQuestionAnswerRepo.findAll({
          populate: ['details', 'details.question', 'details.answer'],
          orderBy: { updatedAt: 'DESC' }
        });

      const surveyQuestionAnswersResponses =
        SurveyQuestionAnswerMapper.toResponseList(surveyQuestionAnswers, true);

      return { success: true, data: surveyQuestionAnswersResponses };
    }, 'Failed to get all survey question answers');
  }

  async getSurveyQuesAnwsById(
    id: string
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestionAnswer =
        await this.unitOfWork.AISurveyQuestionAnswerRepo.findOne(
          { id },
          { populate: ['details', 'details.question', 'details.answer'] }
        );
      if (!surveyQuestionAnswer) {
        return { success: false, error: 'Survey question answer not found' };
      }
      return {
        success: true,
        data: SurveyQuestionAnswerMapper.toResponse(surveyQuestionAnswer, true)
      };
    }, 'Failed to get survey question answer by id');
  }

  async getSurveyQuesAnwsByUserId(
    userId: string, limit: number = 1
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestionAnswers =
        await this.unitOfWork.AISurveyQuestionAnswerRepo.find(
          { userId },
          {
            populate: ['details', 'details.question', 'details.answer'],
            orderBy: { updatedAt: 'DESC' },
            limit
          }
        );

      const surveyQuestionAnswer = surveyQuestionAnswers[0];
      if (!surveyQuestionAnswer) {
        return { success: false, error: 'Survey question answer not found' };
      }
      return {
        success: true,
        data: SurveyQuestionAnswerMapper.toResponse(surveyQuestionAnswer, true)
      };
    }
      , 'Failed to get survey question answer by user id');
  }

  async getLatestSurveyQuesAnwsByUserId(
    userId: string
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse>> {
    return this.getSurveyQuesAnwsByUserId(userId, 1);
  }

  async checkExistSurveyQuesAnwsByUserId(userId: string): Promise<boolean> {
    const surveyQuestionAnswer =
      await this.unitOfWork.AISurveyQuestionAnswerRepo.findOne({ userId });
    return surveyQuestionAnswer !== null;
  }

  async mappingFromRequestToEntity(
    request: SurveyQuesAnwsRequest
  ): Promise<SurveyQuestionAnswer> {
    const details = await Promise.all(
      request.details.map(async (item) => {
        const question = await this.unitOfWork.AISurveyQuestionRepo.findOne(
          { id: item.questionId, isActive: true },
          { populate: ['answers'] }
        );
        if (!question) {
          throw new Error(`Survey question with id ${item.questionId} not found`);
        }
        const answer = question.answers.find(
          (ans) => ans.id === item.answerId
        );
        return {
          question,
          answer: answer!
        };
      })
    );

    return SurveyQuestionAnswerMapper.toEntity({
      userId: request.userId,
      details
    });
  }

  /** Soft delete câu hỏi survey và tất cả câu trả lời liên quan */
  async softDeleteQuestion(id: string): Promise<BaseResponse<void>> {
    return await funcHandlerAsync(async () => {
      const deleted = await this.unitOfWork.AISurveyQuestionRepo.softDeleteQuestion(id);
      if (!deleted) {
        return { success: false, error: 'Survey question not found or already deleted' };
      }
      return { success: true, data: undefined };
    }, 'Failed to delete survey question', true);
  }

  /** Xử lý survey, lưu kết quả trực tiếp, và trả về gợi ý AI */
  async processSurveyAndGetAIResponse(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const questionIds = surveyAnswers.map((qa) => qa.questionId);
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get survey question',
        { questionIds }
      );
    }

    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (surveyQueses.data) {
      for (const surveyAnswer of surveyAnswers) {
        const surveyQues = surveyQueses.data.find((q) => q.id === surveyAnswer.questionId);
        if (surveyQues?.answers && surveyQues.question) {
          const answer = surveyQues.answers.find((ans) => ans.id === surveyAnswer.answerId);
          if (answer?.answer) {
            quesAnses.push({ question: surveyQues.question, answer: answer.answer });
          }
        }
      }
    }

    const prompt = surveyPrompt(quesAnses);

    const savedSurveyQuesAnsResponse = await this.addSurveyQuesAnws(
      new SurveyQuesAnwsRequest({ userId, details: surveyAnswers })
    );

    if (!savedSurveyQuesAnsResponse.success || !savedSurveyQuesAnsResponse.data?.id) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to save survey question answers',
        { userId }
      );
    }

    await this.userLogService.addSurveyQuesAnsDetailToUserLog(userId, savedSurveyQuesAnsResponse.data.id);

    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_SURVEY);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(prompt, systemPrompt, Output.object(conversationOutput));

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId, service: 'AIHelper' }
      );
    }

    if (!aiResponse.data) {
      return Ok('');
    }

    try {
      const parsedResponse = typeof aiResponse.data === 'string'
        ? JSON.parse(aiResponse.data)
        : aiResponse.data;

      if (Array.isArray(parsedResponse?.products) && parsedResponse.products.length > 0) {
        const attachResult = await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
          userId,
          contextType: 'survey',
          sourceRefId: savedSurveyQuesAnsResponse.data.id,
          products: parsedResponse.products,
          metadata: {
            flow: 'survey-v1',
            productCount: parsedResponse.products.length
          }
        });

        parsedResponse.products = attachResult.products;
        if (attachResult.aiAcceptanceId) {
          parsedResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
        }
      }

      return Ok(JSON.stringify(parsedResponse));
    } catch {
      return Ok(aiResponse.data);
    }
  }

  /** Xử lý survey qua BullMQ queue và trả về gợi ý AI mang tính cá nhân hóa */
  async processSurveyV2AndGetAIResponse(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const questionIds = surveyAnswers.map((qa) => qa.questionId);
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get survey question',
        { questionIds }
      );
    }

    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (surveyQueses.data) {
      for (const surveyAnswer of surveyAnswers) {
        const surveyQues = surveyQueses.data.find((q) => q.id === surveyAnswer.questionId);
        if (surveyQues?.answers && surveyQues.question) {
          const answer = surveyQues.answers.find((ans) => ans.id === surveyAnswer.answerId);
          if (answer?.answer) {
            quesAnses.push({ question: surveyQues.question, answer: answer.answer });
          }
        }
      }
    }

    // Phase 1: Thêm vào Queue để lưu record
    await this.surveyQueue.add(SurveyJobName.ADD_SURVEY_QUESTION_AND_ANSWER, { userId, details: surveyAnswers });

    // Phase 2: Phân tích Survey Q&A để trích xuất intent
    const analysis = await this.analysisService.analyzeSurvey(quesAnses);

    let toonProducts = '';

    // Phase 3: Tìm kiếm sản phẩm dựa trên phân tích
    if (analysis) {
      const searchResponse = await this.productService.getProductsByStructuredQuery(analysis);
      if (searchResponse.success && searchResponse.data) {
        const candidates = searchResponse.data.items.slice(0, 15); // Lấy top 15 làm ứng viên
        const minimalProducts = candidates.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brandName,
          image: p.primaryImage,
          category: p.categoryName,
          description: p.description,
          attributes: p.attributes.map(a => `${a.attribute}: ${a.value}`),
          scentNotes: p.scentNotes,
          olfactoryFamilies: p.olfactoryFamilies,
          variants: p.variants.map(v => ({ id: v.id, volume: v.volumeMl, price: v.basePrice }))
        }));
        toonProducts = encodeToolOutput(minimalProducts).encoded;
      }
    }

    // Phase 4: AI Recommendation
    const adminInstruction = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_SURVEY);

    const surveyCtx = surveyContextPrompt(JSON.stringify(quesAnses));
    const productCtx = surveyProductContextPrompt(toonProducts || 'Không tìm thấy sản phẩm phù hợp trong database.');

    const combinedSystemPrompt = surveyRecommendationSystemPrompt(
      adminInstruction || '',
      surveyCtx,
      productCtx
    );

    const aiResponsePayload = await this.aiHelper.textGenerateFromPrompt(
      'Dựa trên kết quả khảo sát và danh sách sản phẩm tiềm năng, hãy đưa ra tư vấn cá nhân hóa và chọn 5 sản phẩm tốt nhất.',
      combinedSystemPrompt,
      Output.object(surveyOutput)
    );

    if (!aiResponsePayload.success || !aiResponsePayload.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get structured AI response for survey',
        { userId, service: 'AIHelper' }
      );
    }

    const aiResponse = typeof aiResponsePayload.data === 'string'
      ? JSON.parse(aiResponsePayload.data)
      : aiResponsePayload.data;

    // Phase 5: Hydrate sản phẩm (Nếu AI trả về productTemp)
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      const productTemp: any[] = aiResponse.productTemp;
      const ids = productTemp.map((item: any) => item.id).filter((id: string) => !!id).slice(0, 5);

      if (ids.length > 0) {
        const productResponse = await this.productService.getProductsByIdsForOutput(ids);
        if (productResponse.success && productResponse.data) {
          const hydratedProducts = productResponse.data;

          // Map to store AI recommendations by ID for fast lookup
          const aiRecMap = new Map<string, any>(
            productTemp.map(item => [item.id, item])
          );

          aiResponse.products = hydratedProducts.map(product => {
            const aiItem = aiRecMap.get(product.id);
            if (aiItem && aiItem.variants && Array.isArray(aiItem.variants)) {
              const variantIdsSet = new Set(aiItem.variants.map((v: any) => v.id));
              return {
                ...product,
                reasoning: aiItem.reasoning || product.reasoning,
                source: aiItem.source || 'SURVEY_RESULT',
                variants: (product.variants || []).filter(v => variantIdsSet.has(v.id))
              };
            }
            return product;
          }).filter(product => product.variants && product.variants.length > 0);
        }
      }
    }


    if (Array.isArray(aiResponse.products) && aiResponse.products.length > 0) {
      const attachResult = await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
        userId,
        contextType: 'survey',
        sourceRefId: `survey-v2-${userId}-${Date.now()}`,
        products: aiResponse.products,
        metadata: {
          flow: 'survey-v2',
          questionCount: surveyAnswers.length,
          productCount: aiResponse.products.length
        }
      });

      aiResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) {
        aiResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
      }
    }

    return Ok(JSON.stringify(aiResponse));
  }

  /**
   * Process survey using per-question query decomposition pattern.
   * Each answer is analyzed and queried independently, then results are merged.
   * Queries with 0 products are automatically skipped during merge.
   */
  async processSurveyWithPerQuestionQueries(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    this.logger.log(`[SurveyPerQuestion] Starting per-question query processing for userId=${userId}, ${surveyAnswers.length} questions`);

    // Step 1: Load all Q&A from database
    const questionIds = surveyAnswers.map((qa) => qa.questionId);
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get survey question', { questionIds });
    }

    const quesAnses: Array<{ questionId: string; question: string; answer: string }> = [];
    if (surveyQueses.data) {
      for (const surveyAnswer of surveyAnswers) {
        const surveyQues = surveyQueses.data.find((q) => q.id === surveyAnswer.questionId);
        if (surveyQues?.answers && surveyQues.question) {
          const answer = surveyQues.answers.find((ans) => ans.id === surveyAnswer.answerId);
          if (answer?.answer) {
            quesAnses.push({
              questionId: surveyAnswer.questionId,
              question: surveyQues.question,
              answer: answer.answer
            });
          }
        }
      }
    }

    if (quesAnses.length === 0) {
      throw new InternalServerErrorWithDetailsException('No valid question-answer pairs found', { surveyAnswers });
    }

    // Step 2: Save survey record
    const savedSurveyQuesAnsResponse = await this.addSurveyQuesAnws(
      new SurveyQuesAnwsRequest({ userId, details: surveyAnswers })
    );
    if (!savedSurveyQuesAnsResponse.success || !savedSurveyQuesAnsResponse.data?.id) {
      throw new InternalServerErrorWithDetailsException('Failed to save survey question answers', { userId });
    }
    await this.userLogService.addSurveyQuesAnsDetailToUserLog(userId, savedSurveyQuesAnsResponse.data.id);

    // Step 3: Analyze EACH answer independently and execute queries
    this.logger.log(`[SurveyPerQuestion] Analyzing ${quesAnses.length} answers individually...`);
    
    const queryResults: SurveyQueryResult[] = [];
    
    for (const qa of quesAnses) {
      try {
        const analysis = await this.analysisService.analyzeSurveyAnswer({
          question: qa.question,
          answer: qa.answer
        });

        if (!analysis) {
          this.logger.warn(`[SurveyPerQuestion] Failed to analyze answer for question: ${qa.question.substring(0, 30)}...`);
          queryResults.push({ questionId: qa.questionId, products: [] });
          continue;
        }

        const searchResponse = await this.productService.getProductsByStructuredQuery(analysis);
        
        if (searchResponse.success && searchResponse.data && searchResponse.data.items.length > 0) {
          const products = searchResponse.data.items.slice(0, 15).map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brandName,
            image: p.primaryImage,
            category: p.categoryName,
            description: p.description,
            attributes: p.attributes.map(a => `${a.attribute}: ${a.value}`),
            scentNotes: p.scentNotes,
            olfactoryFamilies: p.olfactoryFamilies,
            variants: p.variants.map(v => ({ id: v.id, volume: v.volumeMl, price: v.basePrice }))
          }));

          queryResults.push({ questionId: qa.questionId, products });
          this.logger.log(`[SurveyPerQuestion] Question "${qa.question.substring(0, 30)}..." -> Found ${products.length} products`);
        } else {
          this.logger.log(`[SurveyPerQuestion] Question "${qa.question.substring(0, 30)}..." -> 0 products (will be skipped in merge)`);
          queryResults.push({ questionId: qa.questionId, products: [] });
        }
      } catch (error) {
        this.logger.error(`[SurveyPerQuestion] Error processing question "${qa.question.substring(0, 30)}...":`, error);
        queryResults.push({ questionId: qa.questionId, products: [] });
      }
    }

    // Step 4: Merge results (queries with 0 products are automatically filtered)
    const queriesWithProducts = queryResults.filter(r => r.products.length > 0);
    const queriesWithoutProducts = queryResults.filter(r => r.products.length === 0);
    
    this.logger.log(
      `[SurveyPerQuestion] Merge stats: ` +
      `${queriesWithProducts.length} queries with products, ` +
      `${queriesWithoutProducts.length} queries skipped (0 products)`
    );
    
    const mergedProducts = mergeSurveyQueryResults(queryResults, 20);

    // Step 5: Fallback if no products found
    if (mergedProducts.length === 0) {
      this.logger.warn(`[SurveyPerQuestion] No products found from any query, falling back to bestsellers`);
      const fallbackResponse = await this.productService.getBestSellingProducts({
        PageNumber: 1, PageSize: 5, SortOrder: 'desc', IsDescending: true
      });

      if (fallbackResponse.success && fallbackResponse.data) {
        const fallbackProducts = fallbackResponse.data.items.map((item: any) => ({
          id: item.product.id,
          name: item.product.name,
          brand: item.product.brandName,
          image: item.product.primaryImage,
          category: item.product.categoryName,
          description: item.product.description,
          attributes: item.product.attributes.map((a: any) => `${a.attribute}: ${a.value}`),
          scentNotes: item.product.scentNotes,
          olfactoryFamilies: item.product.olfactoryFamilies,
          variants: item.product.variants.map((v: any) => ({ id: v.id, volume: v.volumeMl, price: v.basePrice })),
          source: 'BEST_SELLER_FALLBACK'
        }));
        mergedProducts.push(...fallbackProducts);
      }
    }

    // Step 6: Build context and generate AI recommendation
    const quesAnsesSimple = quesAnses.map(q => ({ question: q.question, answer: q.answer }));
    const surveyCtx = surveyContextPrompt(JSON.stringify(quesAnsesSimple));
    const productCtx = surveyProductContextPrompt(
      mergedProducts.length > 0 
        ? JSON.stringify(mergedProducts) 
        : 'Không tìm thấy sản phẩm phù hợp từ các câu hỏi khảo sát.'
    );

    const adminInstruction = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_SURVEY);
    const combinedSystemPrompt = surveyRecommendationSystemPrompt(adminInstruction || '', surveyCtx, productCtx);

    const aiResponsePayload = await this.aiHelper.textGenerateFromPrompt(
      'Dựa trên kết quả khảo sát và danh sách sản phẩm tiềm năng, hãy đưa ra tư vấn cá nhân hóa và chọn 5 sản phẩm tốt nhất.',
      combinedSystemPrompt,
      Output.object(surveyOutput)
    );

    if (!aiResponsePayload.success || !aiResponsePayload.data) {
      throw new InternalServerErrorWithDetailsException('Failed to get structured AI response for survey', { userId, service: 'AIHelper' });
    }

    const aiResponse = typeof aiResponsePayload.data === 'string' ? JSON.parse(aiResponsePayload.data) : aiResponsePayload.data;

    // Step 7: Hydrate products
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      const productTemp: any[] = aiResponse.productTemp;
      const ids = productTemp.map((item: any) => item.id).filter((id: string) => !!id).slice(0, 5);

      if (ids.length > 0) {
        const productResponse = await this.productService.getProductsByIdsForOutput(ids);
        if (productResponse.success && productResponse.data) {
          const aiRecMap = new Map<string, any>(productTemp.map(item => [item.id, item]));
          aiResponse.products = productResponse.data.map(product => {
            const aiItem = aiRecMap.get(product.id);
            if (aiItem?.variants && Array.isArray(aiItem.variants)) {
              const variantIdsSet = new Set(aiItem.variants.map((v: any) => v.id));
              return {
                ...product,
                reasoning: aiItem.reasoning || product.reasoning,
                source: aiItem.source || 'SURVEY_PER_QUESTION',
                variants: (product.variants || []).filter(v => variantIdsSet.has(v.id))
              };
            }
            return product;
          }).filter(product => product.variants && product.variants.length > 0);
        }
      }
    }

    // Step 8: Attach AI acceptance
    if (Array.isArray(aiResponse.products) && aiResponse.products.length > 0) {
      const attachResult = await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
        userId,
        contextType: 'survey',
        sourceRefId: `survey-per-question-${userId}-${Date.now()}`,
        products: aiResponse.products,
        metadata: {
          flow: 'survey-per-question',
          questionCount: surveyAnswers.length,
          productCount: aiResponse.products.length,
          queryCount: queriesWithProducts.length
        }
      });
      aiResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) {
        aiResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
      }
    }

    this.logger.log(
      `[SurveyPerQuestion] Completed. ` +
      `Questions: ${surveyAnswers.length}, ` +
      `Queries with results: ${queriesWithProducts.length}, ` +
      `Queries skipped (0 products): ${queriesWithoutProducts.length}, ` +
      `Final products: ${aiResponse.products?.length || 0}`
    );

    return Ok(JSON.stringify(aiResponse));
  }
}
