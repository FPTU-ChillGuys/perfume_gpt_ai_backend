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

    static toEntity(dto: ConversationDto): Conversation {
    const conversation = new Conversation({
      userId: dto.userId || ''
    });

    // Set id if provided
    if (dto.id) {
      conversation.id = dto.id;
    }

    // Map messages if provided
    if (dto.messages && dto.messages.length > 0) {
      const messages = dto.messages.map(messageDto => 
        MessageMapper.toEntity(messageDto, conversation)
      );
      conversation.messages.set(messages);
    }

    return conversation;
  }

  static toEntityList(dtos: ConversationDto[]): Conversation[] {
    return dtos.map((dto) => this.toEntity(dto));
  }

  static updateEntity(entity: Conversation, dto: ConversationDto): Conversation {
    if (dto.userId) {
      entity.userId = dto.userId;
    }

    if (dto.messages) {
      const messages = dto.messages.map(messageDto => 
        MessageMapper.toEntity(messageDto, entity)
      );
      entity.messages.set(messages);
    }

    return entity;
  }
}
