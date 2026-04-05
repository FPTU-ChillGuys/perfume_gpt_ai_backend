import { UserLog } from 'src/domain/entities/user-log.entity';
import { UserLogResponse } from '../../dtos/response/user-log.response';
import { UserMessageLogMapper } from './user-message-log.mapper';
import { UserSurveyLogMapper } from './user-survey-log.mapper';
import { UserSearchLogMapper } from './user-search-log.mapper';

export class UserLogMapper {
  static toResponse(entity: UserLog, includeRelations: boolean = false): UserLogResponse {
    const response = new UserLogResponse();
    response.id = entity.id;
    response.userId = entity?.userId!;
    response.createdAt = entity.createdAt;
    response.updatedAt = entity.updatedAt;

    if (includeRelations) {
      response.userMessageLogs = entity.userMessageLogs.isInitialized()
        ? UserMessageLogMapper.toResponseList(entity.userMessageLogs.getItems())
        : [];
      
      response.userSurveyLogs = entity.userSurveyLogs.isInitialized()
        ? UserSurveyLogMapper.toResponseList(entity.userSurveyLogs.getItems())
        : [];
      
      response.userSearchLogs = entity.userSearchLogs.isInitialized()
        ? UserSearchLogMapper.toResponseList(entity.userSearchLogs.getItems())
        : [];
    } else {
      response.userMessageLogs = [];
      response.userSurveyLogs = [];
      response.userSearchLogs = [];
    }

    return response;
  }

  static toResponseList(entities: UserLog[], includeRelations: boolean = false): UserLogResponse[] {
    return entities.map((entity) => this.toResponse(entity, includeRelations));
  }
}
