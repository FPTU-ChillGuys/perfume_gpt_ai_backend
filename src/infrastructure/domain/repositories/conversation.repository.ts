import { Injectable } from '@nestjs/common';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { BaseRepository } from './base/base.repository';

@Injectable()
export class ConversationRepository extends BaseRepository<Conversation> {
  /**
   * Thêm các tin nhắn mới vào cuộc hội thoại có sẵn.
   * Logic hiện tại chỉ thêm 2 tin nhắn cuối cùng (thường là User + Assistant).
   */
  async addMessagesToConversation(
    conversationId: string,
    messages: Message[]
  ): Promise<Conversation> {
    const conversation = await this.findOne({ id: conversationId }, {
      populate: ['messages']
    });
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Chỉ thêm các tin nhắn mới nhất
    if (messages.length >= 2) {
      conversation.messages.add([
        messages[messages.length - 2], 
        messages[messages.length - 1]
      ]);
    } else if (messages.length === 1) {
      conversation.messages.add(messages[0]);
    }

    await this.flush();
    return conversation;
  }

  /**
   * Tạo cuộc hội thoại mới và lưu vào database.
   */
  async addConversation(conversation: Conversation): Promise<Conversation> {
    this.add(conversation);
    await this.flush();
    return conversation;
  }
}
