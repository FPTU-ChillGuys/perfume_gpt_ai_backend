import { Injectable } from '@nestjs/common';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { BaseRepository } from './base/base.repository';

@Injectable()
export class ConversationRepository extends BaseRepository<Conversation> {
  async addMessagesToConversation(
    conversationId: string,
    messages: Message[]
  ): Promise<Conversation> {
    const conversation = await this.findOne(
      { id: conversationId },
      {
        populate: ['messages']
      }
    );

    if (!conversation) {
      throw new Error('Conversation not found');
    }

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

  async addConversation(conversation: Conversation): Promise<Conversation> {
    this.add(conversation);
    await this.flush();
    return conversation;
  }

  async addSingleMessage(
    conversationId: string,
    userId: string,
    message: Message
  ): Promise<Message> {
    let conversation = await this.findOne({ id: conversationId });

    if (!conversation) {
      conversation = new Conversation({ id: conversationId, userId });
      this.add(conversation);
    }

    message.conversation = conversation;
    this.getEntityManager().persist(message);
    await this.flush();

    const saved = await this.getEntityManager().findOne(Message, {
      id: message.id
    });
    return saved ?? message;
  }
}
