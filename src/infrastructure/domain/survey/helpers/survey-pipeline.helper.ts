import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Output } from 'ai';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_SURVEY_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { SurveyQueryValidatorService } from 'src/infrastructure/domain/survey/survey-query-validator.service';
import { SurveyAttributeService } from 'src/infrastructure/domain/survey/survey-attribute.service';
import {
  QueryAnswerPayload,
  QueryFragment,
  SurveyAttributeType
} from 'src/infrastructure/domain/survey/survey-query.types';
import { SurveyQuestionResponse } from 'src/application/dtos/response/survey-question.response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import {
  surveyContextPrompt,
  surveyProductContextPrompt,
  surveyRecommendationSystemPrompt,
  surveyPrompt,
  INSTRUCTION_TYPE_SURVEY
} from 'src/application/constant/prompts';
import {
  surveyOutput,
  conversationOutput
} from 'src/chatbot/output/search.output';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';
import { buildSurveyContextForAI } from 'src/infrastructure/domain/survey/survey-merge.util';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName, SurveyJobName } from 'src/application/constant/processor';
import {
  SurveyProductHelper,
  MinimalProductDto
} from './survey-product.helper';

/** Analysis result từ AI hoặc query fragments */
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

/** AI recommendation response structure */
interface SurveyAIResponse {
  products?: Record<string, unknown>[];
  productTemp?: Record<string, unknown>[];
  aiAcceptanceId?: string;
  [key: string]: unknown;
}

/**
 * Helper xử lý các bước pipeline chung cho Survey flow.
 * Tách từ SurveyService: load Q&A, save record, build AI context, generate recommendation.
 */
@Injectable()
export class SurveyPipelineHelper {
  private readonly logger = new Logger(SurveyPipelineHelper.name);

  constructor(
    @Inject(AI_SURVEY_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly analysisService: AiAnalysisService,
    private readonly userLogService: UserLogService,
    private readonly queryValidator: SurveyQueryValidatorService,
    private readonly surveyAttributeService: SurveyAttributeService,
    @InjectQueue(QueueName.SURVEY_QUEUE) private readonly surveyQueue: Queue
  ) {}

  // ==========================================
  // 1. LOAD Q&A FROM DATABASE
  // ==========================================

  /**
   * Load survey Q&A từ database và map sang dạng text.
   * Dùng chung cho V1, V2, V3.
   */
  mapSurveyAnswersToQA(
    surveyAnswers: { questionId: string; answerId: string }[],
    surveyQueses: SurveyQuestionResponse[]
  ): Array<{ question: string; answer: string }> {
    const quesAnses: Array<{ question: string; answer: string }> = [];

    for (const surveyAnswer of surveyAnswers) {
      const surveyQues = surveyQueses.find(
        (q) => q.id === surveyAnswer.questionId
      );
      if (surveyQues?.answers && surveyQues.question) {
        const answer = surveyQues.answers.find(
          (ans) => ans.id === surveyAnswer.answerId
        );
        if (answer?.answer) {
          quesAnses.push({
            question: surveyQues.question,
            answer: answer.answer
          });
        }
      }
    }

    return quesAnses;
  }

  /**
   * Load survey Q&A với questionId (dùng cho V3 per-question).
   */
  mapSurveyAnswersToQAWithId(
    surveyAnswers: { questionId: string; answerId: string }[],
    surveyQueses: SurveyQuestionResponse[]
  ): Array<{ questionId: string; question: string; answer: string }> {
    const result: Array<{
      questionId: string;
      question: string;
      answer: string;
    }> = [];

    for (const surveyAnswer of surveyAnswers) {
      const surveyQues = surveyQueses.find(
        (q) => q.id === surveyAnswer.questionId
      );
      if (surveyQues?.answers && surveyQues.question) {
        const answer = surveyQues.answers.find(
          (ans) => ans.id === surveyAnswer.answerId
        );
        if (answer?.answer) {
          result.push({
            questionId: surveyAnswer.questionId,
            question: surveyQues.question,
            answer: answer.answer
          });
        }
      }
    }

    return result;
  }

  // ==========================================
  // 2. SAVE SURVEY RECORD
  // ==========================================

  /**
   * Lưu survey record vào DB và log event.
   * Dùng chung cho V1, V3, V4, V5.
   *
   * @param savedId - ID của survey record đã được lưu bởi service.addSurveyQuesAnws()
   * @param userId - ID người dùng
   */
  async logSurveyRecord(userId: string, savedId: string): Promise<void> {
    await this.userLogService.addSurveyQuesAnsDetailToUserLog(userId, savedId);
  }

  // ==========================================
  // 3. AI ANALYSIS
  // ==========================================

  /**
   * Phân tích toàn bộ survey Q&A (dùng cho V2).
   */
  async analyzeSurveyQA(
    quesAnses: Array<{ question: string; answer: string }>
  ): Promise<SurveyAnalysis | null> {
    return this.analysisService.analyzeSurvey(quesAnses);
  }

  /**
   * Phân tích từng câu trả lời riêng lẻ (dùng cho V3, V5).
   */
  async analyzeSingleAnswer(qa: {
    question: string;
    answer: string;
  }): Promise<SurveyAnalysis | null> {
    return this.analysisService.analyzeSurveyAnswer(qa);
  }

  // ==========================================
  // 4. AI RECOMMENDATION
  // ==========================================

  /**
   * Tạo AI recommendation từ survey context + product context.
   * Dùng chung cho V2, V3, V4, V5.
   */
  async generateAIRecommendation(
    quesAnses: Array<{ question: string; answer: string }>,
    productsContext: string,
    userPrompt: string = 'Dựa trên kết quả khảo sát và danh sách sản phẩm tiềm năng, hãy đưa ra tư vấn cá nhân hóa và chọn 5 sản phẩm tốt nhất.'
  ): Promise<SurveyAIResponse> {
    const adminInstruction =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_SURVEY
      );

    const surveyCtx = surveyContextPrompt(JSON.stringify(quesAnses));
    const productCtx = surveyProductContextPrompt(productsContext);

    const combinedSystemPrompt = surveyRecommendationSystemPrompt(
      adminInstruction || '',
      surveyCtx,
      productCtx
    );

    const aiResponsePayload = await this.aiHelper.textGenerateFromPrompt(
      userPrompt,
      combinedSystemPrompt,
      Output.object(surveyOutput)
    );

    if (!aiResponsePayload.success || !aiResponsePayload.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get structured AI response for survey',
        { service: 'AIHelper' }
      );
    }

    return typeof aiResponsePayload.data === 'string'
      ? JSON.parse(aiResponsePayload.data)
      : aiResponsePayload.data;
  }

  /**
   * Tạo AI recommendation dùng buildSurveyContextForAI (V5 pattern).
   */
  async generateAIRecommendationV5(
    quesAnses: Array<{ question: string; answer: string }>,
    topProducts: MinimalProductDto[]
  ): Promise<SurveyAIResponse> {
    const surveyCtx = buildSurveyContextForAI(quesAnses, topProducts);
    const adminInstruction =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_SURVEY
      );
    const combinedSystemPrompt = surveyRecommendationSystemPrompt(
      adminInstruction || '',
      surveyCtx,
      ''
    );

    const aiResponsePayload = await this.aiHelper.textGenerateFromPrompt(
      'Dựa trên kết quả khảo sát và danh sách sản phẩm tiềm năng đã được xếp hạng theo độ phù hợp, hãy đưa ra tư vấn cá nhân hóa và chọn ra 5 sản phẩm tốt nhất. Giải thích rõ tại sao các sản phẩm này lại đứng đầu bảng xếp hạng cho người dùng này.',
      combinedSystemPrompt,
      Output.object(surveyOutput)
    );

    if (!aiResponsePayload.success || !aiResponsePayload.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response for survey v5',
        { service: 'AIHelper' }
      );
    }

    return typeof aiResponsePayload.data === 'string'
      ? JSON.parse(aiResponsePayload.data)
      : aiResponsePayload.data;
  }

  // ==========================================
  // 5. ENCODE PRODUCTS FOR AI CONTEXT
  // ==========================================

  /**
   * Encode danh sách sản phẩm sang TOON format cho AI context.
   */
  encodeProductsForContext(products: MinimalProductDto[]): string {
    return encodeToolOutput(products).encoded;
  }

  // ==========================================
  // 6. V1 AI RECOMMENDATION
  // ==========================================

  /**
   * Generate AI recommendation cho V1 flow.
   * V1 không search products, chỉ dùng Q&A context.
   */
  async generateV1Recommendation(
    contextQA: Array<{ question: string; answer: string }>
  ): Promise<{ success: boolean; data?: string }> {
    const systemPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_SURVEY
      );
    const userPrompt = surveyPrompt(contextQA);
    const aiResponsePayload = await this.aiHelper.textGenerateFromPrompt(
      systemPrompt,
      userPrompt,
      Output.object(conversationOutput)
    );
    return aiResponsePayload;
  }

  // ==========================================
  // 7. ENQUEUE SURVEY SAVE JOB
  // ==========================================

  /**
   * Enqueue job lưu survey record vào background queue.
   */
  async enqueueSurveySave(
    jobName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.surveyQueue.add(jobName, data);
  }

  // ==========================================
  // 8. QUERY VALIDATION
  // ==========================================

  /**
   * Parse answer text thành query fragment (nếu có).
   * Wrapper cho SurveyQueryValidatorService.tryParseAnswerAsQuery().
   */
  tryParseAnswerAsQuery(answer: string): QueryAnswerPayload | null {
    return this.queryValidator.tryParseAnswerAsQuery(answer);
  }

  /**
   * Validate query fragment.
   * Wrapper cho SurveyQueryValidatorService.validateQueryFragment().
   */
  validateQueryFragment(queryFragment: QueryFragment): {
    valid: boolean;
    errors: string[];
  } {
    return this.queryValidator.validateQueryFragment(queryFragment);
  }

  // ==========================================
  // 9. SURVEY ATTRIBUTE VALUES
  // ==========================================

  /**
   * Lấy attribute values cho survey question creation.
   * Wrapper cho SurveyAttributeService.getAttributeValues().
   */
  async getAttributeValues(attributeType: SurveyAttributeType) {
    return this.surveyAttributeService.getAttributeValues(attributeType);
  }

  // ==========================================
  // 10. USER LOG
  // ==========================================

  /**
   * Enqueue rolling summary update cho user log.
   * Wrapper cho UserLogService.enqueueRollingSummaryUpdate().
   */
  async enqueueRollingSummaryUpdate(userId: string): Promise<void> {
    await this.userLogService.enqueueRollingSummaryUpdate(userId);
  }
}
