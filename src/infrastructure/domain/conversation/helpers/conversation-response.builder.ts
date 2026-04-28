import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { UIMessage } from 'ai';

import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { MessageResponse } from 'src/application/dtos/response/conversation/message.response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { ChatMessageRequest } from 'src/application/dtos/request/conversation/chat-message.request';
import { Sender } from 'src/domain/enum/sender.enum';
import { addMessageToMessages, overrideMessagesToConversation } from 'src/infrastructure/domain/utils/message-helper';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

/**
 * Helper xây dựng response cho Conversation chat flow.
 * Tách logic mapping AI response → ConversationResponse khỏi Service.
 */
@Injectable()
export class ConversationResponseBuilder {

  /**
   * Xây dựng context tin nhắn cuối cùng để lưu vào queue.
   * Gộp AI response vào danh sách tin nhắn hiện có.
   */
  buildConversationForSave(
    conversationId: string,
    userId: string,
    aiResponseData: any,
    originalMessages: ChatMessageRequest[]
  ): ChatRequest {
    const finalMessageData = typeof aiResponseData === 'string'
      ? aiResponseData
      : JSON.stringify(aiResponseData);

    const responseConversation = overrideMessagesToConversation(
      conversationId,
      userId,
      addMessageToMessages(finalMessageData, originalMessages as any[])
    );

    return responseConversation;
  }

  /**
   * Xây dựng ConversationResponse từ dữ liệu đã xử lý.
   * Thay thế inline mapping trong chat() method.
   */
  buildChatResponse(
    responseConversation: ChatRequest,
    conversationId: string,
    userId: string
  ): BaseResponse<ConversationResponse> {
    const response = new ConversationResponse();
    response.id = responseConversation.id || conversationId;
    response.userId = responseConversation.userId || userId;
    response.updatedAt = new Date();
    response.messages = (responseConversation.messages || []).map(m => {
      const res = new MessageResponse();
      res.sender = m.sender as Sender;
      res.message = m.message;
      res.createdAt = new Date();
      return res;
    });

    return Ok(response);
  }

  /**
   * Tạo system message cho AI context.
   */
  createSystemMessage(text: string): UIMessage {
    return {
      id: uuid(),
      role: 'system',
      parts: [{ type: 'text', text }]
    };
  }
}