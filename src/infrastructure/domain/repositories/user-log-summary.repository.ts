import { SqlEntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { UserLogSummary } from "src/domain/entities/user-log-summary";

@Injectable()
export class UserLogSummaryRepository extends SqlEntityRepository<UserLogSummary>{}
