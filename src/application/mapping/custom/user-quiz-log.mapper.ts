import { UserQuizLog } from 'src/domain/entities/user-quiz-log.entity';
import { UserQuizLogResponse } from '../../dtos/response/user-quiz-log.response';

export class UserQuizLogMapper {
  static toResponse(entity: UserQuizLog): UserQuizLogResponse {
    return new UserQuizLogResponse({
      id: entity.id,
      quizQuesAnsDetailId: entity.quizQuesAnsDetail?.id || '',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: UserQuizLog[]): UserQuizLogResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
