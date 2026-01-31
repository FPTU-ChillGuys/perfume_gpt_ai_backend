import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from '../repositories/unit-of-work';
import { funcHandlerAsync } from '../utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { AddMessageRequest } from 'src/application/dtos/request/add-message.request';
import { AddConversationRequest } from 'src/application/dtos/request/add-conversation.request';
import { Injectable } from '@nestjs/common';
import { ConversationResponse } from 'src/application/dtos/response/conversation.response';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import { MessageDto } from 'src/application/dtos/common/message.dto';

@Injectable()
export class ConversationService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async addConversation(
    conversationRequest: ConversationDto
  ): Promise<BaseResponse<Conversation>> {
    return await funcHandlerAsync(async () => {
      const conversation = new Conversation({
        userId: conversationRequest.userId
      });
      conversation.messages.set(
        conversationRequest.messages?.map(
          (msg) =>
            new Message({
              conversation: conversation,
              sender: msg.sender as Sender,
              message: msg.message
            })
        ) || []
      );
      await this.unitOfWork.AIConversationRepo.addConversation(conversation);
      return { success: true, data: conversation };
    }, 'Failed to add conversation');
  }

  async updateMessageToConversation(
    id: string,
    messageDtos: MessageDto[]
  ): Promise<BaseResponse> {
    return await funcHandlerAsync(async () => {
      const messages: Message[] = messageDtos.map((msg) => new Message({
        sender: msg.sender as Sender,
        message: msg.message
      }));

      await this.unitOfWork.AIConversationRepo.addMessagesToConversation(
        id,
        messages
      );
      return { success: true };
    }, 'Failed to update messages');
  }

  async getConversationById(id: string): Promise<BaseResponse<Conversation>> {
    return await funcHandlerAsync(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne({
        id
      });
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }
      return { success: true, data: conversation };
    }, 'Failed to get conversation by id');
  }

  async isExistConversation(id: string): Promise<boolean> {
    const conversation = await this.unitOfWork.AIConversationRepo.findOne({
      id
    });
    return conversation !== null && conversation !== undefined;
  }

  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await funcHandlerAsync(
      async () => {
        const conversations = await this.unitOfWork.AIConversationRepo.findAll({
          populate: ['messages']
        });
        const response = conversations.map(
          (conv): ConversationDto => ({
            id: conv.id,
            userId: conv.userId,
            messages: conv.messages.map((msg) => ({
              id: msg.id,
              message: msg.message,
              sender: msg.sender
            }))
          })
        );
        return { success: true, data: response };
      },
      'Failed to get all conversations',
      true
    );
  }
}
