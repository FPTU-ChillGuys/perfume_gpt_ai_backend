import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AddMessageRequest } from 'src/application/dtos/request/add-message.request';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';

@Injectable()
export class ConversationRepository extends SqlEntityRepository<Conversation> {
  async addMessagesToConversation(
    conversationId: string,
    messages: AddMessageRequest[]
  ): Promise<void> {
    const orm = this.getEntityManager();
    const conversation = await this.findOneOrFail({ id: conversationId });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    conversation.messages.set(
      messages.map(
        (msg) =>
          new Message({
            conversation: conversation,
            sender: msg.sender,
            message: msg.message
          })
      )
    );
    orm.persist(conversation);
    await orm.flush();
  }
}
