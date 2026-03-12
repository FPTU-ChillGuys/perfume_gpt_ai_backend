import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from '../repositories/unit-of-work';
import { Mapper } from '@automapper/core';
import { funcHandlerAsync } from '../utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';
import { Inject, Injectable } from '@nestjs/common';
import { QuizQuestionResponse } from 'src/application/dtos/response/quiz-question.response';
import {
  QuizQuestionAnswerMapper,
  QuizQuestionMapper
} from 'src/application/mapping';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuestionAnswerResponse } from 'src/application/dtos/response/quiz-question-answer.response';
import { Output } from 'ai';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName, QuizJobName } from 'src/application/constant/processor';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { AIHelper } from '../helpers/ai.helper';
import { AI_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { UserLogService } from './user-log.service';
import { quizPrompt } from 'src/application/constant/prompts';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { INSTRUCTION_TYPE_QUIZ } from 'src/application/constant/prompts/admin-instruction-types';
import { searchOutput } from 'src/chatbot/utils/output/search.output';

@Injectable()
export class QuizService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper,
    @Inject(AI_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userLogService: UserLogService,
    @InjectQueue(QueueName.QUIZ_QUEUE) private readonly quizQueue: Queue
  ) {}

  async addQuizQues(
    question: QuizQuestionRequest
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const quizQuestion =
          await this.unitOfWork.AIQuizQuestionRepo.createWithAnswers(question);
        return { success: true, data: quizQuestion.id };
      },
      'Failed to add quiz question and answers',
      true
    );
  }

  async updateAnswer(
    id: string,
    request: QuizQuestionRequest
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return await funcHandlerAsync(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne({
        id,
        isActive: true
      });

      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }

      // Cập nhật questionType nếu có
      if (request.questionType !== undefined) {
        quizQuestion.questionType = request.questionType;
      }

      const updatedQuizQuestion =
        await this.unitOfWork.AIQuizQuestionRepo.updateWithAnswers(
          quizQuestion,
          request.answers
        );

      return {
        success: true,
        data: QuizQuestionMapper.toResponse(updatedQuizQuestion)
      };
    }, 'Failed to update quiz answer', true);
  }

  async getQuizQuesById(
    id: string
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return await funcHandlerAsync(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne(
        {
          id,
          isActive: true
        },
        { populate: ['answers'] }
      );
      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }

      const quizQuestionResponse = QuizQuestionMapper.toResponse(quizQuestion, true);

      return { success: true, data: quizQuestionResponse };
    }, 'Failed to get quiz question by id');
  }

  async getQuizQuesByIdList(
    ids: string[]
  ): Promise<BaseResponse<QuizQuestionResponse[]>> {
    return await funcHandlerAsync(async () => {
      const quizQuestions = await this.unitOfWork.AIQuizQuestionRepo.find(
        { id: { $in: ids }, isActive: true },
        { populate: ['answers'] }
      );
      const quizQuestionsResponses =
        QuizQuestionMapper.toResponseList(quizQuestions);
      return { success: true, data: quizQuestionsResponses };
    }, 'Failed to get quiz questions by id list');
  }

  async getAllQuizQues(): Promise<BaseResponse<QuizQuestionResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const quizQuestions = await this.unitOfWork.AIQuizQuestionRepo.find(
          { isActive: true },
          { populate: ['answers'], orderBy: { updatedAt: 'DESC' } }
        );

        const quizQuestionsResponses =
          QuizQuestionMapper.toResponseList(quizQuestions, true);

        return { success: true, data: quizQuestionsResponses };
      },
      'Failed to get all quiz questions',
      true
    );
  }

  async addQuizQuesAnws(
    quizQuesAnws: QuizQuesAnwsRequest
  ): Promise<BaseResponse<QuizQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const quesAns = await this.mappingFromRequestToEntity(quizQuesAnws);

      const quizQuestionAnswer =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.createQuesAns(quesAns);

      //Log last quiz question answer
      this.unitOfWork.UserLogRepo.addQuizQuesAnsDetailLogToUserLog(
        quizQuesAnws.userId,
        quizQuestionAnswer.details.getItems()
      );

      const savedQuesAns = QuizQuestionAnswerMapper.toResponse(
        quizQuestionAnswer,
        true
      );

      return { success: true, data: savedQuesAns };
    }, 'Failed to add quiz question answer', true);
  }

  async getAllQuizQuesAnws(): Promise<
    BaseResponse<QuizQuestionAnswerResponse[]>
  > {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswers =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findAll({
          populate: ['details', 'details.question', 'details.answer'],
          orderBy: { updatedAt: 'DESC' }
        });

      const quizQuestionAnswersResponses =
        QuizQuestionAnswerMapper.toResponseList(quizQuestionAnswers, true);

      return { success: true, data: quizQuestionAnswersResponses };
    }, 'Failed to get all quiz question answers');
  }

  async getQuizQuesAnwsById(
    id: string
  ): Promise<BaseResponse<QuizQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswer =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne(
          { id },
          { populate: ['details', 'details.question', 'details.answer'] }
        );
      if (!quizQuestionAnswer) {
        return { success: false, error: 'Quiz question answer not found' };
      }
      return {
        success: true,
        data: QuizQuestionAnswerMapper.toResponse(quizQuestionAnswer, true)
      };
    }, 'Failed to get quiz question answer by id');
  }

  async getQuizQuesAnwsByUserId(
    userId: string
  ): Promise<BaseResponse<QuizQuestionAnswerResponse>> {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswer =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne({ userId }, { populate: ['details', 'details.question', 'details.answer'] });
      if (!quizQuestionAnswer) {
        return { success: false, error: 'Quiz question answer not found' };
      }
      return {
        success: true,
        data: QuizQuestionAnswerMapper.toResponse(quizQuestionAnswer, true)
      };
    }
      , 'Failed to get quiz question answer by user id');
  }

  async checkExistQuizQuesAnwsByUserId(userId: string): Promise<boolean> {
    const quizQuestionAnswer =
      await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne({ userId });
    return quizQuestionAnswer !== null;
  }

  async mappingFromRequestToEntity(
    request: QuizQuesAnwsRequest
  ): Promise<QuizQuestionAnswer> {
    const details = await Promise.all(
      request.details.map(async (item) => {
        const question = await this.unitOfWork.AIQuizQuestionRepo.findOne(
          { id: item.questionId, isActive: true },
          { populate: ['answers'] }
        );
        if (!question) {
          throw new Error(`Quiz question with id ${item.questionId} not found`);
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

    return QuizQuestionAnswerMapper.toEntity({
      userId: request.userId,
      details
    });
  }

  /** Soft delete câu hỏi quiz và tất cả câu trả lời liên quan */
  async softDeleteQuestion(id: string): Promise<BaseResponse<void>> {
    return await funcHandlerAsync(async () => {
      const deleted = await this.unitOfWork.AIQuizQuestionRepo.softDeleteQuestion(id);
      if (!deleted) {
        return { success: false, error: 'Quiz question not found or already deleted' };
      }
      return { success: true, data: undefined };
    }, 'Failed to delete quiz question', true);
  }

  /** Xử lý quiz, lưu kết quả trực tiếp, và trả về gợi ý AI */
  async processQuizAndGetAIResponse(
    userId: string,
    quizAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const questionIds = quizAnswers.map((qa) => qa.questionId);
    const quizQueses = await this.getQuizQuesByIdList(questionIds);
    if (!quizQueses.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get quiz question',
        { questionIds }
      );
    }

    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (quizQueses.data) {
      for (const quizAnswer of quizAnswers) {
        const quizQues = quizQueses.data.find((q) => q.id === quizAnswer.questionId);
        if (quizQues?.answers && quizQues.question) {
          const answer = quizQues.answers.find((ans) => ans.id === quizAnswer.answerId);
          if (answer?.answer) {
            quesAnses.push({ question: quizQues.question, answer: answer.answer });
          }
        }
      }
    }

    const prompt = quizPrompt(quesAnses);

    const savedQuizQuesAnsResponse = await this.addQuizQuesAnws(
      new QuizQuesAnwsRequest({ userId, details: quizAnswers })
    );

    if (!savedQuizQuesAnsResponse.success || !savedQuizQuesAnsResponse.data?.id) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to save quiz question answers',
        { userId }
      );
    }

    await this.userLogService.addQuizQuesAnsDetailToUserLog(userId, savedQuizQuesAnsResponse.data.id);

    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_QUIZ);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(prompt, systemPrompt, Output.object(searchOutput));

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId, service: 'AIHelper' }
      );
    }

    return Ok(aiResponse.data);
  }

  /** Xử lý quiz qua BullMQ queue và trả về gợi ý AI */
  async processQuizV2AndGetAIResponse(
    userId: string,
    quizAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const questionIds = quizAnswers.map((qa) => qa.questionId);
    const quizQueses = await this.getQuizQuesByIdList(questionIds);
    if (!quizQueses.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get quiz question',
        { questionIds }
      );
    }

    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (quizQueses.data) {
      for (const quizAnswer of quizAnswers) {
        const quizQues = quizQueses.data.find((q) => q.id === quizAnswer.questionId);
        if (quizQues?.answers && quizQues.question) {
          const answer = quizQues.answers.find((ans) => ans.id === quizAnswer.answerId);
          if (answer?.answer) {
            quesAnses.push({ question: quizQues.question, answer: answer.answer });
          }
        }
      }
    }

    const prompt = quizPrompt(quesAnses);

    await this.quizQueue.add(QuizJobName.ADD_QUIZ_QUESTION_AND_ANSWER, { userId, details: quizAnswers });

    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_QUIZ);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(prompt, systemPrompt, Output.object(searchOutput));

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId, service: 'AIHelper' }
      );
    }

    return Ok(aiResponse.data);
  }
}
