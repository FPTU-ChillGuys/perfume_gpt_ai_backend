import { Conversation } from 'src/domain/entities/conversation.entity';
import { MessageMapper } from './message.mapper';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';

export class ConversationMapper {
  static toResponse(
    entity: Conversation,
    includeMessages: boolean = false
  ): ConversationDto {
    const response = new ConversationDto({
      id: entity.id,
      userId: entity.userId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });

    if (includeMessages && entity.messages.isInitialized()) {
      response.messages = MessageMapper.toResponseList(
        entity.messages.getItems()
      );
    } else {
      response.messages = [];
    }

    return response;
  }

  static toResponseList(
    entities: Conversation[],
    includeMessages: boolean = false
  ): ConversationDto[] {
    return entities.map((entity) => this.toResponse(entity, includeMessages));
  }
}
