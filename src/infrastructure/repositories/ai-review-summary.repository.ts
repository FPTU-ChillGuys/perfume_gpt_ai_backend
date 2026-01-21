import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';

@Injectable()
export class AIReviewSummaryRepository extends SqlEntityRepository<AIReviewSummary> {}
