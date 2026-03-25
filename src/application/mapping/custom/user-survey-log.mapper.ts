import { UserSurveyLog } from 'src/domain/entities/user-survey-log.entity';
import { UserSurveyLogResponse } from '../../dtos/response/user-survey-log.response';

export class UserSurveyLogMapper {
  static toResponse(entity: UserSurveyLog): UserSurveyLogResponse {
    return new UserSurveyLogResponse({
      id: entity.id,
      surveyQuesAnsDetailId: entity.surveyQuesAnsDetail?.id || '',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: UserSurveyLog[]): UserSurveyLogResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
