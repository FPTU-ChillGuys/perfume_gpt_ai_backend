import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ReviewSummaryLog } from 'src/domain/entities/review-summary-log.entity';

@Injectable()
export class ReviewSummaryLogRepository extends SqlEntityRepository<ReviewSummaryLog> {}
