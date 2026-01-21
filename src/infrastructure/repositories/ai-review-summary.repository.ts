import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';

export class AIReviewSummaryRepository extends SqlEntityRepository<AIReviewSummary> {}
