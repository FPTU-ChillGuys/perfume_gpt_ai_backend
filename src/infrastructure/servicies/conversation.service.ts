import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from '../repositories/unit-of-work';
import { funcHandler } from '../utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { AddMessageRequest } from 'src/application/dtos/request/add-message.request';
import { MessageResponse } from 'src/application/dtos/response/message.response';
import { AddConversationRequest } from 'src/application/dtos/request/add-conversation.request';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async addConversation(
    conversationRequest: AddConversationRequest
  ): Promise<BaseResponse<Conversation>> {
    return await funcHandler(async () => {
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
    return await funcHandler(async () => {
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
    return await funcHandler(async () => {
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
    return await funcHandler(async () => {
      const conversations = await this.unitOfWork.AIConversationRepo.findAll();
      return { success: true, data: conversations };
    }, 'Failed to get all conversations');
  }
}
