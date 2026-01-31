import { UserSearchLog } from 'src/domain/entities/user-search.log.entity';
import { UserSearchLogResponse } from '../../dtos/response/user-search-log.response';

export class UserSearchLogMapper {
  static toResponse(entity: UserSearchLog): UserSearchLogResponse {
    return new UserSearchLogResponse({
      id: entity.id,
      searchText: entity.content || '',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: UserSearchLog[]): UserSearchLogResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
