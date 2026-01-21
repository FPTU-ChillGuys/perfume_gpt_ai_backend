import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';

@Injectable()
export class AIRequestResponseRepository extends SqlEntityRepository<AIRequestResponse> {}
