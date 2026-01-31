import { UserMessageLog } from 'src/domain/entities/user-message-log.entity';
import { UserMessageLogResponse } from '../../dtos/response/user-message-log.response';

export class UserMessageLogMapper {
  static toResponse(entity: UserMessageLog): UserMessageLogResponse {
    return new UserMessageLogResponse({
      id: entity.id,
      messageId: entity.message?.id || '',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: UserMessageLog[]): UserMessageLogResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
