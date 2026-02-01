import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from '../repositories/unit-of-work';
import { Mapper } from '@automapper/core';
import { funcHandlerAsync } from '../utils/error-handler';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';
import { Injectable } from '@nestjs/common';
import { QuizQuestionResponse } from 'src/application/dtos/response/quiz-question.response';
import {
  QuizQuestionAnswerMapper,
  QuizQuestionMapper
} from 'src/application/mapping';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuestionAnswerResponse } from 'src/application/dtos/response/quiz-question-answer.response';

@Injectable()
export class QuizService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
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
    answers: QuizAnswerRequest[]
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return await funcHandlerAsync(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne({
        id
      });
      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }

      const updatedQuizQuestion =
        await this.unitOfWork.AIQuizQuestionRepo.updateWithAnswers(
          id,
          quizQuestion.question,
          answers
        );

      return {
        success: true,
        data: QuizQuestionMapper.toResponse(updatedQuizQuestion)
      };
    }, 'Failed to update quiz answer');
  }

  async getQuizQuesById(
    id: string
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return await funcHandlerAsync(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne(
        {
          id
        },
        { populate: ['answers'] }
      );
      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }

      const quizQuestionResponse = QuizQuestionMapper.toResponse(quizQuestion);

      return { success: true, data: quizQuestionResponse };
    }, 'Failed to get quiz question by id');
  }

  async getAllQuizQues(): Promise<BaseResponse<QuizQuestionResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const quizQuestions = await this.unitOfWork.AIQuizQuestionRepo.findAll({
          populate: ['answers']
        });

        const quizQuestionsResponses =
          QuizQuestionMapper.toResponseList(quizQuestions);

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
        quizQuestionAnswer.details[quizQuesAnws.details.length - 1]
      );

      const savedQuesAns = QuizQuestionAnswerMapper.toResponse(
        quizQuestionAnswer,
        true
      );

      return { success: true, data: savedQuesAns };
    }, 'Failed to add quiz question answer');
  }

  async getAllQuizQuesAnws(): Promise<
    BaseResponse<QuizQuestionAnswerResponse[]>
  > {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswers =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findAll();

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
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne({ id });
      if (!quizQuestionAnswer) {
        return { success: false, error: 'Quiz question answer not found' };
      }
      return {
        success: true,
        data: QuizQuestionAnswerMapper.toResponse(quizQuestionAnswer, true)
      };
    }, 'Failed to get quiz question answer by id');
  }

  async mappingFromRequestToEntity(
    request: QuizQuesAnwsRequest
  ): Promise<QuizQuestionAnswer> {
    const details = await Promise.all(
      request.details.map(async (item) => {
        const question = await this.unitOfWork.AIQuizQuestionRepo.findOne({
          id: item.questionId
        });
        const answer = await question?.answers.find(
          (ans) => ans.id === item.answerId
        );
        if (!question) {
          throw new Error(`Quiz question with id ${item.questionId} not found`);
        }
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
}
