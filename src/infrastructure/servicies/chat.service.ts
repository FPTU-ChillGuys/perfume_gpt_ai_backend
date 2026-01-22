import { AddPromptRequest } from 'src/application/dtos/request/add-prompt.request';
import { UnitOfWork } from '../repositories/unit-of-work';
import { Injectable } from '@nestjs/common';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { AddConversationRequest } from 'src/application/dtos/request/add-conversation.request';

@Injectable()
export class ChatService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper,
  ) {}

  async savePrompt(
    addPromptRequest: AddPromptRequest,
  ): Promise<BaseResponse<AIRequestResponse>> {
    const aiRequestResponse = await this.mapper.mapAsync(
      addPromptRequest,
      AddPromptRequest,
      AIRequestResponse,
    );
    try {
      this.unitOfWork.AIRequestResponseRepo.create(aiRequestResponse);
      return { success: true, data: aiRequestResponse };
    } catch {
      return { success: false, error: 'Failed to save prompt' };
    }
  }

  async updateResponse(id: string, response: string): Promise<BaseResponse> {
    try {
      const aiRequestResponse =
        await this.unitOfWork.AIRequestResponseRepo.findOne({ id });

      if (!aiRequestResponse) {
        return { success: false, error: 'Request not found' };
      }

      this.unitOfWork.AIRequestResponseRepo.assign(aiRequestResponse, {
        response: response,
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to update response' };
    }
  }

  async getAllsReqRes(): Promise<BaseResponse<AIRequestResponse[]>> {
    try {
      return {
        success: true,
        data: await this.unitOfWork.AIRequestResponseRepo.findAll(),
      };
    } catch {
      return { success: false, error: 'Failed to get all request-responses' };
    }
  }

  async getReqResById(id: string): Promise<BaseResponse<AIRequestResponse>> {
    try {
      const aiRequestResponse =
        await this.unitOfWork.AIRequestResponseRepo.findOne({ id });
      if (!aiRequestResponse) {
        return { success: false, error: 'Request-Response not found' };
      }
      return { success: true, data: aiRequestResponse };
    } catch {
      return { success: false, error: 'Failed to get request-response by id' };
    }
  }

  async addConversation(
    conversationRequest: AddConversationRequest,
  ): Promise<BaseResponse<Conversation>> {
    try {
      const conversation = await this.mapper.mapAsync(
        conversationRequest,
        AddConversationRequest,
        Conversation,
      );
      this.unitOfWork.AIConversationRepo.create(conversation);
      return { success: true, data: conversation };
    } catch {
      return { success: false, error: 'Failed to add conversation' };
    }
  }
}
