import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { AIConversation } from 'src/domain/entities/ai-conversation.entity';

export class AIConversationRepository extends SqlEntityRepository<AIConversation> {}
