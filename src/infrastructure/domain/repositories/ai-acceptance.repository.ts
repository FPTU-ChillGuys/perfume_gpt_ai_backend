import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';

@Injectable()
export class AIAcceptanceRepository extends SqlEntityRepository<AIAcceptance> {}
