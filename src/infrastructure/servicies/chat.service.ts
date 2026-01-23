import { AddPromptRequest } from 'src/application/dtos/request/add-prompt.request';
import { UnitOfWork } from '../repositories/unit-of-work';
import { Injectable } from '@nestjs/common';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { AddConversationRequest } from 'src/application/dtos/request/add-conversation.request';
import { MessageResponse } from 'src/application/dtos/response/message.response';
import { AddMessageRequest } from 'src/application/dtos/request/add-message.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/add-quiz-question.request';
import { QuizAnswerRequest } from 'src/application/dtos/request/add-quiz-answer.request';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { funcHandler } from '../utils/error-handler';

@Injectable()
export class ChatService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async savePrompt(
    addPromptRequest: AddPromptRequest
  ): Promise<BaseResponse<AIRequestResponse>> {
    return funcHandler(async () => {
      const aiRequestResponse = await this.mapper.mapAsync(
        addPromptRequest,
        AddPromptRequest,
        AIRequestResponse
      );
      this.unitOfWork.AIRequestResponseRepo.create(aiRequestResponse);
      return { success: true, data: aiRequestResponse };
    }, 'Failed to save prompt');
  }

  async updateResponse(id: string, response: string): Promise<BaseResponse> {
    return funcHandler(async () => {
      const aiRequestResponse =
        await this.unitOfWork.AIRequestResponseRepo.findOne({ id });

      if (!aiRequestResponse) {
        return { success: false, error: 'Request not found' };
      }

      this.unitOfWork.AIRequestResponseRepo.assign(aiRequestResponse, {
        response: response
      });
      return { success: true };
    }, 'Failed to update response');
  }

  async getAllReqRes(): Promise<BaseResponse<AIRequestResponse[]>> {
    return funcHandler(async () => {
      return {
        success: true,
        data: await this.unitOfWork.AIRequestResponseRepo.findAll()
      };
    }, 'Failed to get all request-responses');
  }

  async getReqResById(id: string): Promise<BaseResponse<AIRequestResponse>> {
    return funcHandler(async () => {
      const aiRequestResponse =
        await this.unitOfWork.AIRequestResponseRepo.findOne({ id });
      if (!aiRequestResponse) {
        return { success: false, error: 'Request-Response not found' };
      }
      return { success: true, data: aiRequestResponse };
    }, 'Failed to get request-response by id');
  }

  async addConversation(
    conversationRequest: AddConversationRequest
  ): Promise<BaseResponse<Conversation>> {
    return funcHandler(async () => {
      const conversation = await this.mapper.mapAsync(
        conversationRequest,
        AddConversationRequest,
        Conversation
      );
      this.unitOfWork.AIConversationRepo.create(conversation);
      return { success: true, data: conversation };
    }, 'Failed to add conversation');
  }

  async updateMessageToConversation(
    id: string,
    messages: AddMessageRequest[]
  ): Promise<BaseResponse> {
    return funcHandler(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne({
        id
      });
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      this.unitOfWork.AIConversationRepo.assign(conversation, {
        messages: await this.mapper.mapArrayAsync(
          messages,
          AddMessageRequest,
          MessageResponse
        )
      });

      return { success: true };
    }, 'Failed to update messages');
  }

  async getConversationById(id: string): Promise<BaseResponse<Conversation>> {
    return funcHandler(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne({
        id
      });
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }
      return { success: true, data: conversation };
    }, 'Failed to get conversation by id');
  }

  async getAllConversations(): Promise<BaseResponse<Conversation[]>> {
    return funcHandler(async () => {
      const conversations = await this.unitOfWork.AIConversationRepo.findAll();
      return { success: true, data: conversations };
    }, 'Failed to get all conversations');
  }

  async addQuesAnws(question: QuizQuestionRequest): Promise<BaseResponse> {
    return funcHandler(async () => {
      const quizQuestion = await this.mapper.mapAsync(
        question,
        QuizQuestionRequest,
        QuizQuestion
      );
      this.unitOfWork.AIQuizQuestionRepo.create(quizQuestion);
      return { success: true };
    }, 'Failed to add quiz question and answers');
  }

  async updateAnswer(
    id: string,
    answers: QuizAnswerRequest[]
  ): Promise<BaseResponse> {
    return funcHandler(async () => {
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

  getQuizQuesById(id: string): Promise<BaseResponse<QuizQuestion>> {
    return funcHandler(async () => {
      const quizQuestion = await this.unitOfWork.AIQuizQuestionRepo.findOne({
        id
      });
      if (!quizQuestion) {
        return { success: false, error: 'Quiz question not found' };
      }
      return { success: true, data: quizQuestion };
    }, 'Failed to get quiz question by id');
  }
}
