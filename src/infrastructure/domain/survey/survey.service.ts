import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { Mapper } from '@automapper/core';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class SurveyService {
  constructor(
    private unitOfWork: UnitOfWork,
    @Inject(AI_SURVEY_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    @InjectQueue(QueueName.SURVEY_QUEUE) private readonly surveyQueue: Queue,
    private readonly productService: ProductService,
    private readonly analysisService: AiAnalysisService
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

      //Log last survey question answer
      const surveyEventIds = await this.unitOfWork.EventLogRepo.createSurveyEventsFromDetails(
        surveyQuesAnws.userId,
        surveyQuestionAnswer.details.getItems()
      );

      if (surveyEventIds.length) {
        await this.userLogService.enqueueRollingSummaryUpdate(surveyQuesAnws.userId);
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
    userId: string
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const surveyQuestionAnswer =
        await this.unitOfWork.AISurveyQuestionAnswerRepo.findOne({ userId }, { populate: ['details', 'details.question', 'details.answer'] });
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

    return Ok(aiResponse.data);
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
        const ids = aiResponse.productTemp.map((item: any) => item.id).filter((id: string) => !!id).slice(0, 5);
        if (ids.length > 0) {
            const productResponse = await this.productService.getProductsByIdsForOutput(ids);
            if (productResponse.success && productResponse.data) {
                const hydratedProducts = productResponse.data;
                const recommendationsMap = new Map<string, string[]>();
                aiResponse.productTemp.forEach((item: any) => {
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

    return Ok(JSON.stringify(aiResponse));
  }
}
