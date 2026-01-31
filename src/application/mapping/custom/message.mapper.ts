import { MessageDto } from 'src/application/dtos/common/message.dto';
import { Message } from 'src/domain/entities/message.entity';

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
}
