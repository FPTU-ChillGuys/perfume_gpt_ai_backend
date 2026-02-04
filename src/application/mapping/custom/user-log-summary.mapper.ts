import { UserLogSummaryResponse } from "src/application/dtos/response/user-log-summary.response";
import { UserSearchLogResponse } from "src/application/dtos/response/user-search-log.response";
import { UserLogSummary } from "src/domain/entities/user-log-summary";
import { UserSearchLog } from "src/domain/entities/user-search.log.entity";
import { id } from "zod/v4/locales";

export class UserLogSummaryMapper {
  static toResponse(entity: UserLogSummary): UserLogSummaryResponse {
    return new UserLogSummaryResponse({
      id: entity.id,
      userId: entity.userId,
      startDate: entity.startDate,
      endDate: entity.endDate,
      logSummary: entity.logSummary,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: UserLogSummary[]): UserLogSummaryResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
