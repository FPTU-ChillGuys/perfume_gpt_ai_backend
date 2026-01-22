import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Conversation } from 'src/domain/entities/conversation.entity';

@Injectable()
export class ConversationRepository extends SqlEntityRepository<Conversation> {}
