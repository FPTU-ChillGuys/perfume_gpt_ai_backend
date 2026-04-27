import { MessageDto } from 'src/application/dtos/common/message.dto';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { Sender } from 'src/domain/enum/sender.enum';

export class MessageMapper {
  static toResponse(entity: Message): MessageDto {
    return new MessageDto({
      id: entity.id,
      sender: entity.sender,
      message: entity.message,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: Message[]): MessageDto[] {
    return entities.map((entity) => this.toResponse(entity));
  }

   static toEntity(dto: MessageDto, conversation?: Array<Message> | Conversation): Message {
    const message = new Message({
      sender: dto.sender as Sender,
      message: typeof dto.message === 'string' ? dto.message : JSON.stringify(dto.message)
    });

    // Set id if provided
    if (dto.id) {
      message.id = dto.id;
    }

    // Set conversation if provided
    if (conversation && !Array.isArray(conversation)) {
      message.conversation = conversation;
    }

    return message;
  }

  static toEntityList(dtos: MessageDto[], conversation?: Conversation): Message[] {
    return dtos.map((dto) => this.toEntity(dto, conversation));
  }

  static updateEntity(entity: Message, dto: MessageDto): Message {
    if (dto.sender) {
      entity.sender = dto.sender as Sender;
    }

    if (dto.message) {
      entity.message = typeof dto.message === 'string' ? dto.message : JSON.stringify(dto.message);
    }

    return entity;
  }
}
