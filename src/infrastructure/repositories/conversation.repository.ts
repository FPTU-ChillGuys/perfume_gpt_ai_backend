import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { MessageDto } from 'src/application/dtos/common/message.dto';
import { AddMessageRequest } from 'src/application/dtos/request/add-message.request';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { Sender } from 'src/domain/enum/sender.enum';

@Injectable()
export class ConversationRepository extends SqlEntityRepository<Conversation> {
  async addMessagesToConversation(
    conversationId: string,
    messages: MessageDto[]
  ): Promise<Conversation> {
    const orm = this.getEntityManager();
    const conversation = await this.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    conversation.messages.set(
      messages.map(
        (msg) =>
          new Message({
            conversation: conversation,
            sender: msg.sender as Sender,
            message: msg.message
          })
      )
    );
    orm.persist(conversation);
    await orm.flush();
    return conversation;
  }
}
