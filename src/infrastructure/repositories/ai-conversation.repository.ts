import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AIConversation } from 'src/domain/entities/ai-conversation.entity';

@Injectable()
export class AIConversationRepository extends SqlEntityRepository<AIConversation> {}
