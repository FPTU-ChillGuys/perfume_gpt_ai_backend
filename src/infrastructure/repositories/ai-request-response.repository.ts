import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';

export class AIRequestResponseRepository extends SqlEntityRepository<AIRequestResponse> {}
