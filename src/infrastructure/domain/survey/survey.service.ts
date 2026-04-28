import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { Mapper } from '@automapper/core';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { CreateQuestionFromAttributeRequest } from 'src/infrastructure/domain/survey/survey-query.types';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SurveyQuestionResponse } from 'src/application/dtos/response/survey-question.response';
import {
  SurveyQuestionAnswerMapper,
  SurveyQuestionMapper
} from 'src/application/mapping';
import { SurveyQuesAnwsRequest } from 'src/application/dtos/request/survey-ques-ans.request';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';
import { InternalServerErrorWithDetailsException, BadRequestWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { SurveyQuestionAnswer } from 'src/domain/entities/survey-question-answer.entity';
import { v4 as uuidv4 } from 'uuid';
import { QueryFragment, QueryAnswerPayload, QueryFragmentMatch, QueryFragmentAttribute, QueryFragmentBudget } from 'src/infrastructure/domain/survey/survey-query.types';
import { SurveyJobName } from 'src/application/constant/processor';
import { mergeSurveyQueryResults, SurveyQueryResult } from 'src/infrastructure/domain/survey/survey-merge.util';

// Helpers
import { SurveyProductHelper, MinimalProductDto, MinimalVariantDto, BudgetConstraint } from './helpers/survey-product.helper';
import { SurveyPipelineHelper } from './helpers/survey-pipeline.helper';

/** Analysis result từ AI hoặc query fragments — dùng cho V4/V5 survey pipeline */
interface SurveyAnalysis {
  logic?: (string | string[])[] | null;
  genderValues?: string[];
  originValues?: string[];
  concentrationValues?: string[];
  budget?: { min?: number | null; max?: number | null } | null;
  pagination?: { pageNumber: number; pageSize: number } | null;
  sorting?: { field: string; isDescending: boolean } | null;
  [key: string]: unknown;
}

/** Per-question analysis entry cho V5 hybrid flow */
interface PerQuestionAnalysis {
  questionId: string;
  question: string;
  answer: string;
  analysis: SurveyAnalysis | null;
}

/** AI recommendation response structure */
interface SurveyAIResponse {
  products?: Record<string, unknown>[];
  productTemp?: Record<string, unknown>[];
  aiAcceptanceId?: string;
  [key: string]: unknown;
}


@Injectable()
export class SurveyService {

  private readonly logger = new Logger(SurveyService.name);

  constructor(
    private unitOfWork: UnitOfWork,
    // Helpers
    private readonly productHelper: SurveyProductHelper,
    private readonly pipelineHelper: SurveyPipelineHelper
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

  /** Tạo câu hỏi survey từ thuộc tính (tự động sinh câu trả lời query-based) */
  async createQuestionFromAttribute(body: CreateQuestionFromAttributeRequest): Promise<BaseResponse<string>> {
    // 1. Get values for the attribute type
    const attrValues = await this.pipelineHelper.getAttributeValues(body.attributeType);

    // 2. Collect all value items
    let allValues = attrValues.values || [];

    // Handle subGroups for 'attribute' type
    if (body.attributeType === 'attribute' && attrValues.subGroups) {
      if (body.attributeName) {
        const group = attrValues.subGroups.find(g => g.attributeName === body.attributeName);
        allValues = group?.values || [];
      } else {
        throw new BadRequestWithDetailsException(
          'attributeName is required when attributeType is "attribute"',
          { attributeType: body.attributeType }
        );
      }
    }

    // Handle budget type with custom ranges
    if (body.attributeType === 'budget' && body.budgetRanges && body.budgetRanges.length > 0) {
      allValues = body.budgetRanges.map(r => ({
        displayText: r.label,
        queryFragment: { type: 'budget' as const, min: r.min, max: r.max },
      }));
    }

    // 3. Filter selected values if specified
    if (body.selectedValues && body.selectedValues.length > 0) {
      const selectedSet = new Set(body.selectedValues);
      allValues = allValues.filter(v => selectedSet.has(v.displayText));
    }

    if (allValues.length < 2) {
      throw new BadRequestWithDetailsException(
        'Cần ít nhất 2 giá trị để tạo câu hỏi',
        { availableValues: allValues.length }
      );
    }

    // 4. Validate all query fragments
    for (const val of allValues) {
      const validation = this.pipelineHelper.validateQueryFragment(val.queryFragment);
      if (!validation.valid) {
        throw new BadRequestWithDetailsException(
          `Invalid query fragment for "${val.displayText}": ${validation.errors.join(', ')}`,
          { displayText: val.displayText, errors: validation.errors }
        );
      }
    }

    // 5. Build survey question request with JSON answers
    const surveyQuestionReq: SurveyQuestionRequest = {
      question: body.question,
      questionType: body.questionType as any,
      answers: allValues.map(val => new SurveyAnswerRequest({
        answer: JSON.stringify({
          displayText: val.displayText,
          queryFragment: val.queryFragment,
        }),
      })),
    };

    return this.addSurveyQues(surveyQuestionReq);
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
        await this.pipelineHelper.enqueueRollingSummaryUpdate(logUserId);
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

  async getSurveyHistoryListByUserId(
    userId: string
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse[]>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestionAnswers =
        await this.unitOfWork.AISurveyQuestionAnswerRepo.find(
          { userId },
          {
            populate: ['details', 'details.question', 'details.answer'],
            orderBy: { updatedAt: 'DESC' }
            // No limit applied to fetch full history
          }
        );

      const responses = SurveyQuestionAnswerMapper.toResponseList(surveyQuestionAnswers, true);
      return { success: true, data: responses };
    }, 'Failed to get survey history list by user id');
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

  /** Xử lý survey, lưu kết quả trực tiếp, và trả về gợi ý AI (V1 — legacy) */
  async processSurveyAndGetAIResponse(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    // Step 1: Load Q&A
    const questionIds = surveyAnswers.map((qa) => qa.questionId);
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get survey question', { questionIds });
    }

    const quesAnses = this.pipelineHelper.mapSurveyAnswersToQA(surveyAnswers, surveyQueses.data || []);

    // Step 2: Save survey record
    const savedId = await this.saveSurveyAndLog(userId, surveyAnswers);

    // Step 3: Generate AI recommendation
    const aiResponsePayload = await this.pipelineHelper.generateV1Recommendation(quesAnses);

    if (!aiResponsePayload.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI response', { userId, service: 'AIHelper' });
    }
    if (!aiResponsePayload.data) {
      return Ok('');
    }

    // Step 4: Parse & attach AI acceptance
    const parsedResponse = typeof aiResponsePayload.data === 'string'
      ? JSON.parse(aiResponsePayload.data)
      : aiResponsePayload.data;

    if (Array.isArray(parsedResponse?.products) && parsedResponse.products.length > 0) {
      const attachResult = await this.productHelper.attachAIAcceptance(parsedResponse.products, {
        contextType: 'survey',
        sourceRefId: savedId,
        flow: 'survey-v1',
        questionCount: surveyAnswers.length,
      });
      parsedResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) parsedResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
    }

    return Ok(JSON.stringify(parsedResponse));
  }

  /** Xử lý survey qua BullMQ queue và trả về gợi ý AI mang tính cá nhân hóa */
  async processSurveyV2AndGetAIResponse(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    // Step 1: Load Q&A
    const questionIds = surveyAnswers.map((qa) => qa.questionId);
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get survey question', { questionIds });
    }

    const quesAnses = this.pipelineHelper.mapSurveyAnswersToQA(surveyAnswers, surveyQueses.data || []);

    // Step 2: Queue save record
    await this.pipelineHelper.enqueueSurveySave(SurveyJobName.ADD_SURVEY_QUESTION_AND_ANSWER, { userId, details: surveyAnswers });

    // Step 3: Analyze & Search
    const analysis = await this.pipelineHelper.analyzeSurveyQA(quesAnses);
    let toonProducts = '';

    if (analysis) {
      const minimalProducts = await this.productHelper.searchProducts(analysis);
      if (minimalProducts.length > 0) {
      }
    }

    // Step 4: AI Recommendation
    const aiResponse = await this.pipelineHelper.generateAIRecommendation(
      quesAnses,
      toonProducts || 'Không tìm thấy sản phẩm phù hợp trong database.'
    );

    // Step 5: Hydrate products
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      aiResponse.products = await this.productHelper.hydrateAndFilterProducts(
        aiResponse.productTemp,
        analysis?.budget as BudgetConstraint | undefined
      );
    }

    // Step 6: Attach AI acceptance
    if (Array.isArray(aiResponse.products) && aiResponse.products.length > 0) {
      const attachResult = await this.productHelper.attachAIAcceptance(aiResponse.products, {
        contextType: 'survey',
        sourceRefId: `survey-v2-${userId}-${Date.now()}`,
        flow: 'survey-v2',
        questionCount: surveyAnswers.length,
      });
      aiResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) aiResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
    }

    return Ok(JSON.stringify(aiResponse));
  }

  /**
   * Process survey using per-question query decomposition pattern.
   * Each answer is analyzed and queried independently, then results are merged.
   */
  async processSurveyWithPerQuestionQueries(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    this.logger.log(`[SurveyPerQuestion] Starting for userId=${userId}, ${surveyAnswers.length} questions`);

    // Step 1: Load Q&A
    const questionIds = surveyAnswers.map((qa) => qa.questionId);
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get survey question', { questionIds });
    }

    const quesAnses = this.pipelineHelper.mapSurveyAnswersToQAWithId(surveyAnswers, surveyQueses.data || []);
    if (quesAnses.length === 0) {
      throw new InternalServerErrorWithDetailsException('No valid question-answer pairs found', { surveyAnswers });
    }

    // Step 2: Save survey record
    const savedId = await this.saveSurveyAndLog(userId, surveyAnswers);

    // Step 3: Analyze each answer independently and execute queries
    const queryResults: SurveyQueryResult[] = [];
    for (const qa of quesAnses) {
      try {
        const analysis = await this.pipelineHelper.analyzeSingleAnswer({ question: qa.question, answer: qa.answer });
        if (!analysis) {
          queryResults.push({ questionId: qa.questionId, products: [] });
          continue;
        }

        const products = await this.productHelper.searchProducts(analysis);
        if (products.length > 0) {
          queryResults.push({ questionId: qa.questionId, products });
        }
      } catch (error) {
        this.logger.error(`[SurveyPerQuestion] Error processing question "${qa.question.substring(0, 30)}...":`, error);
        queryResults.push({ questionId: qa.questionId, products: [] });
      }
    }

    // Step 4: Merge & Fallback
    const mergedProducts = await this.mergeWithFallback(queryResults);

    // Step 5: AI Recommendation
    const quesAnsesSimple = quesAnses.map(q => ({ question: q.question, answer: q.answer }));
    const aiResponse = await this.pipelineHelper.generateAIRecommendation(
      quesAnsesSimple,
      mergedProducts.length > 0 ? JSON.stringify(mergedProducts) : 'Không tìm thấy sản phẩm phù hợp từ các câu hỏi khảo sát.'
    );

    // Step 6: Hydrate & AI acceptance
    await this.hydrateAndAttachAcceptance(aiResponse, userId, surveyAnswers.length, 'survey-per-question');

    const queriesWithProducts = queryResults.filter(r => r.products.length > 0);
    this.logger.log(`[SurveyPerQuestion] Completed. Queries with results: ${queriesWithProducts.length}, Final products: ${(aiResponse.products as Record<string, unknown>[])?.length || 0}`);

    return Ok(JSON.stringify(aiResponse));
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══  SURVEY V4 — Query-based processing (no AI analysis)  ═══
  // ═══════════════════════════════════════════════════════════════

  /**
   * Process survey using pre-built query fragments stored in answers.
   * Câu trả lời chứa sẵn JSON query → trực tiếp query sản phẩm → AI chọn top 5.
   */
  async processSurveyV4QueryBased(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    this.logger.log(`[SurveyV4] Starting query-based processing for userId=${userId}, ${surveyAnswers.length} answers`);

    // Step 1: Load Q&A
    const questionIds = [...new Set(surveyAnswers.map(qa => qa.questionId))];
    const surveyQueses = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQueses.success || !surveyQueses.data) {
      throw new InternalServerErrorWithDetailsException('Failed to get survey questions', { questionIds });
    }

    // Step 2: Parse query fragments from answers
    const { questionQueryMap, quesAnsesForContext } = this.parseV4QueryFragments(surveyAnswers, surveyQueses.data);

    // Step 3: Save survey record
    const savedId = await this.saveSurveyAndLog(userId, surveyAnswers);

    // Step 4: Query products for each question
    const queryResults = await this.executeV4Queries(questionQueryMap);

    // Step 5: Merge & fallback
    const mergedProducts = await this.mergeWithFallback(queryResults);

    // Step 6: AI Recommendation
    const top5Products = mergedProducts.slice(0, 5);
    const aiResponse = await this.pipelineHelper.generateAIRecommendation(
      quesAnsesForContext,
      top5Products.length > 0 ? JSON.stringify(top5Products) : 'Không tìm thấy sản phẩm phù hợp từ các câu hỏi khảo sát.'
    );

    // Step 7: Build final products with budget filter
    const budget = this.extractBudgetFromFragments(questionQueryMap);
    aiResponse.products = this.buildV4ProductList(top5Products, (aiResponse.productTemp as Record<string, unknown>[]) || [], budget);

    // Step 8: Attach AI acceptance
    if (Array.isArray(aiResponse.products) && aiResponse.products.length > 0) {
      const attachResult = await this.productHelper.attachAIAcceptance(aiResponse.products, {
        contextType: 'survey',
        sourceRefId: `survey-v4-${userId}-${Date.now()}`,
        flow: 'survey-v4-query',
        questionCount: surveyAnswers.length,
        extra: { queryCount: queryResults.filter(r => r.products.length > 0).length },
      });
      aiResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) aiResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
    }

    this.logger.log(`[SurveyV4] Completed. Final products: ${(aiResponse.products as Record<string, unknown>[])?.length || 0}`);
    return Ok(JSON.stringify(aiResponse));
  }

  /**
   * SURVEY V5 — Hybrid processing (AI + Query fragments) with Matching Score
   * - Hybrid: Chấp nhận cả answer JSON (Query-based) và Text (AI 분석).
   * - Soft Constraints: Tất cả tiêu chí dùng để tính RANK.
   * - Post-Merge Filter: Chỉ Budget + Concentration lọc sau cùng.
   */
  async processSurveyV5Hybrid(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    this.logger.log(`[SurveyV5] Starting hybrid processing for userId=${userId}, ${surveyAnswers.length} answers`);

    // Step 1: Load Q&A
    const questionIds = [...new Set(surveyAnswers.map(qa => qa.questionId))];
    const surveyQuesesResponse = await this.getSurveyQuesByIdList(questionIds);
    if (!surveyQuesesResponse.success || !surveyQuesesResponse.data) {
      throw new InternalServerErrorWithDetailsException('Failed to get survey questions', { questionIds });
    }

    // Step 2: Hybrid Answer Analysis (Parse JSON or Call AI)
    const { perQuestionAnalysis, quesAnsesForContext } = await this.analyzeV5HybridAnswers(surveyAnswers, surveyQuesesResponse.data);

    // Step 3: Save survey record
    await this.saveSurveyAndLog(userId, surveyAnswers);

    // Step 4: Extract Global Budget & Concentration
    const { budget, concentrations } = this.extractV5GlobalConstraints(perQuestionAnalysis);

    // Step 5: Execute Queries (excluding Budget & Concentration for ranking)
    const queryResults = await this.executeV5Queries(perQuestionAnalysis);

    // Step 6: Merge & Filter
    let mergedProducts = mergeSurveyQueryResults(queryResults, 50);
    mergedProducts = this.productHelper.filterVariantsByBudgetAndConcentration(mergedProducts, budget, concentrations);

    // Step 7: AI Recommendation
    const topProducts = mergedProducts.slice(0, 10);
    const aiResponse = await this.pipelineHelper.generateAIRecommendationV5(quesAnsesForContext, topProducts);

    // Step 8: Build final products with budget/concentration filter
    aiResponse.products = this.buildV5ProductList(topProducts, (aiResponse.productTemp as Record<string, unknown>[]) || [], budget, concentrations);

    // Step 9: Attach AI acceptance
    if ((aiResponse.products as Record<string, unknown>[])?.length > 0) {
      const attachResult = await this.productHelper.attachAIAcceptance(aiResponse.products as Record<string, unknown>[], {
        contextType: 'survey',
        sourceRefId: `survey-v5-${userId}-${Date.now()}`,
        flow: 'survey-v5-hybrid',
        questionCount: surveyAnswers.length,
        extra: { minPrice: budget?.min, maxPrice: budget?.max },
      });
      aiResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) aiResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
    }

    return Ok(JSON.stringify(aiResponse));
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /** Lưu survey record và log event. Dùng chung cho V3, V4, V5. */
  private async saveSurveyAndLog(
    userId: string,
    surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<string> {
    const savedResponse = await this.addSurveyQuesAnws(
      new SurveyQuesAnwsRequest({ userId, details: surveyAnswers })
    );
    if (!savedResponse.success || !savedResponse.data?.id) {
      throw new InternalServerErrorWithDetailsException('Failed to save survey question answers', { userId });
    }
    await this.pipelineHelper.logSurveyRecord(userId, savedResponse.data.id);
    return savedResponse.data.id;
  }

  /** Merge query results + fallback to bestsellers. Dùng chung cho V3, V4. */
  private async mergeWithFallback(queryResults: SurveyQueryResult[]): Promise<any[]> {
    const mergedProducts = mergeSurveyQueryResults(queryResults, 20);

    if (mergedProducts.length === 0) {
      this.logger.warn('[SurveyMerge] No products found, falling back to bestsellers');
      const fallbackProducts = await this.productHelper.getBestSellerFallback();
      mergedProducts.push(...fallbackProducts);
    }

    return mergedProducts;
  }

  /** Hydrate products from AI response + attach AI acceptance. Dùng chung cho V3. */
  private async hydrateAndAttachAcceptance(
    aiResponse: { productTemp?: unknown[]; products?: unknown[]; aiAcceptanceId?: string },
    userId: string,
    questionCount: number,
    flow: string
  ): Promise<void> {
    if (aiResponse.productTemp && Array.isArray(aiResponse.productTemp)) {
      aiResponse.products = await this.productHelper.hydrateAndFilterProducts(aiResponse.productTemp);
    }

    if (Array.isArray(aiResponse.products) && aiResponse.products.length > 0) {
      const attachResult = await this.productHelper.attachAIAcceptance(aiResponse.products, {
        contextType: 'survey',
        sourceRefId: `${flow}-${userId}-${Date.now()}`,
        flow,
        questionCount,
      });
      aiResponse.products = attachResult.products;
      if (attachResult.aiAcceptanceId) aiResponse.aiAcceptanceId = attachResult.aiAcceptanceId;
    }
  }

  /** Parse query fragments từ survey answers cho V4. */
  private parseV4QueryFragments(
    surveyAnswers: { questionId: string; answerId: string }[],
    surveyQueses: SurveyQuestionResponse[]
  ): {
    questionQueryMap: Map<string, { question: string; fragments: QueryFragment[]; displayAnswers: string[] }>;
    quesAnsesForContext: Array<{ question: string; answer: string }>;
  } {
    const questionQueryMap = new Map<string, { question: string; fragments: QueryFragment[]; displayAnswers: string[] }>();
    const quesAnsesForContext: Array<{ question: string; answer: string }> = [];

    for (const surveyAnswer of surveyAnswers) {
      const surveyQues = surveyQueses.find(q => q.id === surveyAnswer.questionId);
      if (!surveyQues?.answers || !surveyQues.question) continue;

      const answer = surveyQues.answers.find(ans => ans.id === surveyAnswer.answerId);
      if (!answer?.answer) continue;

      const parsed = this.pipelineHelper.tryParseAnswerAsQuery(answer.answer);

      if (!questionQueryMap.has(surveyAnswer.questionId)) {
        questionQueryMap.set(surveyAnswer.questionId, {
          question: surveyQues.question,
          fragments: [],
          displayAnswers: [],
        });
      }

      const entry = questionQueryMap.get(surveyAnswer.questionId)!;
      if (parsed) {
        entry.fragments.push(parsed.queryFragment);
        entry.displayAnswers.push(parsed.displayText);
      } else {
        entry.displayAnswers.push(answer.answer);
      }
    }

    for (const [, entry] of questionQueryMap) {
      quesAnsesForContext.push({ question: entry.question, answer: entry.displayAnswers.join(', ') });
    }

    return { questionQueryMap, quesAnsesForContext };
  }

  /** Execute product queries cho từng question trong V4. */
  private async executeV4Queries(
    questionQueryMap: Map<string, { question: string; fragments: QueryFragment[]; displayAnswers: string[] }>
  ): Promise<SurveyQueryResult[]> {
    const queryResults: SurveyQueryResult[] = [];

    for (const [questionId, entry] of questionQueryMap) {
      if (entry.fragments.length === 0) {
        this.logger.warn(`[SurveyV4] Question "${entry.question.substring(0, 30)}..." has no query fragments, skipping`);
        queryResults.push({ questionId, products: [] });
        continue;
      }

      try {
        const analysis = this.queryFragmentsToAnalysis(entry.fragments);
        const products = await this.productHelper.searchProducts(analysis);

        if (products.length > 0) {
          queryResults.push({ questionId, products });
        }
      } catch (error) {
        this.logger.error(`[SurveyV4] Error processing question "${entry.question.substring(0, 30)}...":`, error);
        queryResults.push({ questionId, products: [] });
      }
    }

    return queryResults;
  }

  /** Extract budget constraint từ query fragments (V4). */
  private extractBudgetFromFragments(
    questionQueryMap: Map<string, { question: string; fragments: QueryFragment[]; displayAnswers: string[] }>
  ): BudgetConstraint | undefined {
    for (const [, entry] of questionQueryMap.entries()) {
      for (const frag of entry.fragments) {
        if (frag.type === 'budget') {
          const bFrag = frag as QueryFragmentBudget;
          this.logger.log(`[SurveyV4] Budget constraint detected: min=${bFrag.min}, max=${bFrag.max}`);
          return { min: bFrag.min, max: bFrag.max };
        }
      }
    }
    return undefined;
  }

  /** Build final product list cho V4: merge AI recommendation với query results, filter budget. */
  private buildV4ProductList(
    top5Products: MinimalProductDto[],
    productTemp: Record<string, unknown>[],
    budget?: BudgetConstraint
  ): Record<string, unknown>[] {
    const aiRecMap = new Map<string, Record<string, unknown>>(productTemp.map((item) => [item.id as string, item]));

    const products = top5Products.map(p => {
      const aiItem = aiRecMap.get(p.id);
      let variants = (p.variants || []).map((v) => ({
        id: v.id,
        sku: `SKU-${v.id.substring(0, 8)}`,
        volumeMl: v.volume || 0,
        basePrice: v.price || 0,
      }));

      if (budget) {
        variants = this.productHelper.filterVariantsByBudget([{ ...p, variants }], budget)[0]?.variants || [];
        this.logger.log(`[SurveyV4] Product ${p.name}: budget filter applied, ${variants.length} variants remaining`);
      }

      return {
        id: p.id,
        name: p.name,
        brandName: p.brand,
        primaryImage: p.image,
        reasoning: (aiItem?.reasoning as string) || 'Sản phẩm phù hợp nhất với nhu cầu của bạn.',
        source: p.source || (aiItem?.source as string) || 'SURVEY_V4_QUERY',
        variants,
      };
    }).filter(p => (p as { variants: unknown[] }).variants.length > 0);

    this.logger.log(`[SurveyV4] Assigned ${products.length} products (after budget variant filtering).`);
    return products;
  }

  /** Hybrid analysis cho V5: parse JSON hoặc call AI cho từng answer. */
  private async analyzeV5HybridAnswers(
    surveyAnswers: { questionId: string; answerId: string }[],
    surveyQueses: SurveyQuestionResponse[]
  ): Promise<{
    perQuestionAnalysis: PerQuestionAnalysis[];
    quesAnsesForContext: Array<{ question: string; answer: string }>;
  }> {
    const perQuestionAnalysis: PerQuestionAnalysis[] = [];
    const quesAnsesForContext: Array<{ question: string; answer: string }> = [];

    for (const surveyAnswer of surveyAnswers) {
      const surveyQues = surveyQueses.find(q => q.id === surveyAnswer.questionId);
      if (!surveyQues?.answers || !surveyQues.question) continue;

      const answer = surveyQues.answers.find(ans => ans.id === surveyAnswer.answerId);
      if (!answer?.answer) continue;

      let analysis: SurveyAnalysis | null = null;
      let displayAnswer = answer.answer;

      const parsed = this.pipelineHelper.tryParseAnswerAsQuery(answer.answer);
      if (parsed) {
        analysis = this.queryFragmentsToAnalysis([parsed.queryFragment]);
        displayAnswer = parsed.displayText;
      } else {
        this.logger.log(`[SurveyV5] Manual text detected for question "${surveyQues.question.substring(0, 30)}...", analyzing with AI...`);
        analysis = await this.pipelineHelper.analyzeSingleAnswer({ question: surveyQues.question, answer: answer.answer });
      }

      if (analysis) {
        perQuestionAnalysis.push({ questionId: surveyAnswer.questionId, question: surveyQues.question, answer: displayAnswer, analysis });
        quesAnsesForContext.push({ question: surveyQues.question, answer: displayAnswer });
      }
    }

    return { perQuestionAnalysis, quesAnsesForContext };
  }

  /** Extract global budget & concentration constraints từ V5 analysis. */
  private extractV5GlobalConstraints(
    perQuestionAnalysis: PerQuestionAnalysis[]
  ): { budget: BudgetConstraint | undefined; concentrations: Set<string> } {
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    const concentrations = new Set<string>();

    for (const item of perQuestionAnalysis) {
      if (!item.analysis) continue;
      const b = item.analysis.budget;
      if (b) {
        if (b.min != null) minPrice = minPrice !== undefined ? Math.max(minPrice, b.min!) : b.min!;
        if (b.max != null) maxPrice = maxPrice !== undefined ? Math.min(maxPrice, b.max!) : b.max!;
      }
      if (item.analysis.concentrationValues && Array.isArray(item.analysis.concentrationValues)) {
        item.analysis.concentrationValues.forEach((c: string) => concentrations.add(c.toLowerCase()));
      }
    }

    this.logger.log(`[SurveyV5] Global Constraints: Budget[${minPrice}-${maxPrice}], Concentrations[${Array.from(concentrations).join(', ')}]`);

    const budget = (minPrice !== undefined || maxPrice !== undefined) ? { min: minPrice, max: maxPrice } : undefined;
    return { budget, concentrations };
  }

  /** Execute queries cho V5 (strip budget & concentration for ranking). */
  private async executeV5Queries(
    perQuestionAnalysis: PerQuestionAnalysis[]
  ): Promise<SurveyQueryResult[]> {
    const queryResults: SurveyQueryResult[] = [];

    for (const item of perQuestionAnalysis) {
      const analysisCopy = { ...item.analysis };
      delete analysisCopy.budget;
      delete analysisCopy.concentrationValues;
      analysisCopy.pagination = { pageNumber: 1, pageSize: 20 };

      try {
        const products = await this.productHelper.searchProductsWithConcentration(analysisCopy);
        if (products.length > 0) {
          queryResults.push({ questionId: item.questionId, products });
        } else {
          queryResults.push({ questionId: item.questionId, products: [] });
        }
      } catch (error) {
        this.logger.error(`[SurveyV5] Error processing question "${item.question.substring(0, 30)}...":`, error);
        queryResults.push({ questionId: item.questionId, products: [] });
      }
    }

    return queryResults;
  }

  /** Build final product list cho V5: merge AI recommendation + filter budget/concentration. */
  private buildV5ProductList(
    topProducts: MinimalProductDto[],
    productTemp: Record<string, unknown>[],
    budget: BudgetConstraint | undefined,
    concentrations: Set<string>
  ): Record<string, unknown>[] {
    const aiRecMap = new Map<string, Record<string, unknown>>(productTemp.map((item) => [item.id as string, item]));

    return topProducts
      .filter(p => aiRecMap.has(p.id))
      .map(p => {
        const aiItem = aiRecMap.get(p.id);
        let variants = (p.variants || []).map((v) => ({
          id: v.id,
          sku: `SKU-${v.id.substring(0, 8)}`,
          volumeMl: v.volume || 0,
          basePrice: v.price || 0,
        }));

        // Filter variants theo budget & concentration
        if (budget || concentrations.size > 0) {
          variants = variants.filter((v) => {
            const price = v.basePrice;
            if (budget?.min !== undefined && price < budget.min) return false;
            if (budget?.max !== undefined && price > budget.max) return false;
            return true;
          });
        }

        return {
          id: p.id, name: p.name,
          brandName: p.brand,
          primaryImage: p.image,
          reasoning: (aiItem?.reasoning as string) || 'Sản phẩm đạt điểm tương xứng cao nhất với sở thích của bạn.',
          source: p.source || (aiItem?.source as string) || 'SURVEY_V5_HYBRID',
          variants,
        };
      })
      .filter(p => (p as { variants: unknown[] }).variants.length > 0)
      .slice(0, 5);
  }

  /**
   * Convert query fragments thành structured analysis object cho getProductsByStructuredQuery().
   * Mỗi fragment map tới 1 field tương ứng trong analysis.
   */
  private queryFragmentsToAnalysis(fragments: QueryFragment[]): SurveyAnalysis {
    const logic: string[][] = [];
    const genderValues: string[] = [];
    const originValues: string[] = [];
    const concentrationValues: string[] = [];
    let budget: { min?: number; max?: number } | undefined;

    for (const frag of fragments) {
      switch (frag.type) {
        case 'gender':
          genderValues.push((frag as QueryFragmentMatch).match);
          break;
        case 'origin':
          originValues.push((frag as QueryFragmentMatch).match);
          break;
        case 'concentration':
          concentrationValues.push((frag as QueryFragmentMatch).match);
          break;
        case 'brand':
        case 'category':
        case 'note':
        case 'family':
          logic.push([(frag as QueryFragmentMatch).match]);
          break;
        case 'attribute':
          logic.push([(frag as QueryFragmentAttribute).match]);
          break;
        case 'budget':
          const bFrag = frag as QueryFragmentBudget;
          budget = { min: bFrag.min, max: bFrag.max };
          break;
      }
    }

    return {
      logic,
      genderValues,
      originValues,
      concentrationValues,
      budget,
      pagination: { pageNumber: 1, pageSize: 15 },
      sorting: { field: 'Newest', isDescending: true },
    };
  }
}
