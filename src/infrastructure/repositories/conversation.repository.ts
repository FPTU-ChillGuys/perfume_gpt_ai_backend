import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';

@Injectable()
export class ConversationRepository extends SqlEntityRepository<Conversation> {
  async addMessagesToConversation(
    conversationId: string,
    messages: Message[]
  ): Promise<Conversation> {
    const orm = this.getEntityManager();
    const conversation = await this.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    conversation.messages.set(messages);
    orm.persist(conversation);
    await orm.flush();
    return conversation;
  }

  async addConversation(conversation: Conversation): Promise<Conversation> {
    const orm = this.getEntityManager();
    orm.persist(conversation);
    await orm.flush();
    return conversation;
  }
}
