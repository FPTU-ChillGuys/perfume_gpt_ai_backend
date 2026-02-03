import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { UnitOfWork } from '../repositories/unit-of-work';
import { funcHandlerAsync } from '../utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Injectable } from '@nestjs/common';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import { MessageDto } from 'src/application/dtos/common/message.dto';
import {
  ConversationMapper,
  MessageMapper
} from 'src/application/mapping/custom';

@Injectable()
export class ConversationService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async addConversation(
    conversationRequest: ConversationDto
  ): Promise<BaseResponse<ConversationDto>> {
    return await funcHandlerAsync(
      async () => {
        const existedConversation = await this.isExistConversation(
          conversationRequest.id || ''
        );

        if (existedConversation) {
          return { success: false, error: 'Conversation already exists' };
        }

        const conversation = new Conversation({
          id: conversationRequest.id || '',
          userId: conversationRequest.userId
        });
        conversation.messages.set(
          MessageMapper.toEntityList(
            conversationRequest.messages || [],
            conversation
          )
        );

        //Luu conversation
        await this.unitOfWork.AIConversationRepo.addConversation(conversation);

        //Luu message vao log
        await this.unitOfWork.UserLogRepo.addMessageLogToUserLog(
          conversation.userId,
          conversation.messages.getItems()[0]
        );

        const conversationDto = ConversationMapper.toResponse(
          conversation,
          true
        );

        return { success: true, data: conversationDto };
      },
      'Failed to add conversation',
      true
    );
  }

  async updateMessageToConversation(
    id: string,
    messageDtos: MessageDto[]
  ): Promise<BaseResponse<MessageDto[]>> {
    return await funcHandlerAsync(async () => {
      const messages: Message[] = messageDtos.map(
        (msg) =>
          new Message({
            sender: msg.sender as Sender,
            message: msg.message
          })
      );

      const conversation =
        await this.unitOfWork.AIConversationRepo.addMessagesToConversation(
          id,
          messages
        );

      //Lay message luu vao log
      await this.unitOfWork.UserLogRepo.addMessageLogToUserLog(
        conversation.userId,
        messages[messages.length - 1]
      );

      return {
        success: true,
        data: MessageMapper.toResponseList(conversation.messages.getItems())
      };
    }, 'Failed to update messages');
  }

  async getConversationById(
    id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await funcHandlerAsync(async () => {
      const conversation = await this.unitOfWork.AIConversationRepo.findOne(
        {
          id
        },
        { populate: ['messages'] }
      );
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      const conversationDto = ConversationMapper.toResponse(conversation, true);

      return { success: true, data: conversationDto };
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

        const response = ConversationMapper.toResponseList(
          conversations,
          false
        );

        return { success: true, data: response };
      },
      'Failed to get all conversations',
      true
    );
  }
}
