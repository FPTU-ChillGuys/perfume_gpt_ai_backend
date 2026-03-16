import { UserLogSummaryResponse } from "src/application/dtos/response/user-log-summary.response";
import { UserLogSummary } from "src/domain/entities/user-log-summary";

export class UserLogSummaryMapper {
  static toResponse(entity: UserLogSummary): UserLogSummaryResponse {
    return new UserLogSummaryResponse({
      id: entity.id,
      userId: entity.userId,
      logSummary: entity.logSummary,
      featureSnapshot: entity.featureSnapshot,
      totalEvents: entity.totalEvents,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: UserLogSummary[]): UserLogSummaryResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
