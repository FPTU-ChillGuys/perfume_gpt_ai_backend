import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { MessageDto } from 'src/application/dtos/common/message.dto';
import { AddMessageRequest } from 'src/application/dtos/request/add-message.request';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { Sender } from 'src/domain/enum/sender.enum';

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
