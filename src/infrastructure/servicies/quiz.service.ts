import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from '../repositories/unit-of-work';
import { Mapper } from '@automapper/core';
import { funcHandler, funcHandlerAsync } from '../utils/error-handler';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/add-ques-ans.request';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswerRequest } from 'src/application/dtos/request/add-quiz-answer.request';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionRequest } from 'src/application/dtos/request/add-quiz-question.request';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuizService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async addQuesAnws(
    question: QuizQuestionRequest
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        //Map thu cong tam thoi
        const quizQuestion: QuizQuestion = new QuizQuestion();
        quizQuestion.question = question.question;
        console.log('Mapped Answers:', quizQuestion);
        const createdQuizQuestionId =
          await this.unitOfWork.AIQuizQuestionRepo.insert(quizQuestion);
        return { success: true, data: createdQuizQuestionId };
      },
      'Failed to add quiz question and answers',
      true
    );
  }

  async updateAnswer(
    id: string,
    answers: QuizAnswerRequest[]
  ): Promise<BaseResponse> {
    return await funcHandlerAsync(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne({
        id
      });
      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }

      const mappingedAnswers = await this.mapper.mapArrayAsync(
        answers,
        QuizAnswerRequest,
        QuizAnswer
      );
      this.unitOfWork.AIQuizQuestionRepo.assign(quizQuestion, {
        answers: mappingedAnswers
      });
      return { success: true };
    }, 'Failed to update quiz answer');
  }

  async getQuizQuesById(id: string): Promise<BaseResponse<QuizQuestion>> {
    return await funcHandlerAsync(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne({
        id
      });
      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }
      return { success: true, data: quizQuestion };
    }, 'Failed to get quiz question by id');
  }

  async getAllQuizQues(): Promise<BaseResponse<QuizQuestion[]>> {
    return await funcHandlerAsync(
      async () => {
        const quizQuestions =
          await this.unitOfWork.AIQuizQuestionRepo.findAll();
        return { success: true, data: quizQuestions };
      },
      'Failed to get all quiz questions',
      true
    );
  }

  async addQuizQuesAnws(
    quizQuesAnws: AddQuesAnwsRequest
  ): Promise<BaseResponse<QuizQuestionAnswer>> {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswer = await this.mapper.mapAsync(
        quizQuesAnws,
        AddQuesAnwsRequest,
        QuizQuestionAnswer
      );
      this.unitOfWork.AIQuizQuestionAnswerRepo.create(quizQuestionAnswer);
      return { success: true, data: quizQuestionAnswer };
    }, 'Failed to add quiz question answer');
  }

  async getAllQuizQuesAnws(): Promise<BaseResponse<QuizQuestionAnswer[]>> {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswers =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findAll();
      return { success: true, data: quizQuestionAnswers };
    }, 'Failed to get all quiz question answers');
  }

  async getQuizQuesAnwsById(
    id: string
  ): Promise<BaseResponse<QuizQuestionAnswer>> {
    return await funcHandlerAsync(async () => {
      const quizQuestionAnswer =
        await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne({ id });
      if (!quizQuestionAnswer) {
        return { success: false, error: 'Quiz question answer not found' };
      }
      return { success: true, data: quizQuestionAnswer };
    }, 'Failed to get quiz question answer by id');
  }
}
