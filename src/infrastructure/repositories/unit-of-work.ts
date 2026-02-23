import { Injectable } from '@nestjs/common';
import { AdminInstructionRepository } from './admin-instruction.repository';
import { ConversationRepository } from './conversation.repository';
import { QuizQuestionAnswerRepository } from './quiz-question-answer.repository';
import { QuizQuestionRepository } from './quiz-question.repository';
import { UserLogRepository } from './user-log.repository';
import { UserLogSummaryRepository } from './user-log-summary.repository';
import { AIAcceptanceRepository } from './ai-acceptance.repository';
import { ReviewSummaryLogRepository } from './review-summary.repository';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ReviewLog } from 'src/domain/entities/review-log.entity';

@Injectable()
export class UnitOfWork {
  constructor(
    private readonly aiConversationRepository: ConversationRepository,
    private readonly aiQuizQuestionRepository: QuizQuestionRepository,
    private readonly aiQuizQuestionAnswerRepository: QuizQuestionAnswerRepository,
    private readonly userLogRepository: UserLogRepository,
    private readonly reviewSummaryLogRepository: ReviewSummaryLogRepository,
    private readonly userLogSummaryRepository: UserLogSummaryRepository,
    private readonly aiAcceptanceRepository: AIAcceptanceRepository,
    private readonly adminInstructionRepository: AdminInstructionRepository,
    @InjectRepository(InventoryLog) private readonly inventoryLogRepository: EntityRepository<InventoryLog>,
    @InjectRepository(ReviewLog) private readonly reviewLogRepository: EntityRepository<ReviewLog>
  ) {}

  get AIConversationRepo(): ConversationRepository {
    return this.aiConversationRepository;
  }
  get AIQuizQuestionRepo(): QuizQuestionRepository {
    return this.aiQuizQuestionRepository;
  }
  get AIQuizQuestionAnswerRepo(): QuizQuestionAnswerRepository {
    return this.aiQuizQuestionAnswerRepository;
  }
  get UserLogRepo(): UserLogRepository {
    return this.userLogRepository;
  }
  get ReviewSummaryLogRepo(): ReviewSummaryLogRepository {
    return this.reviewSummaryLogRepository;
  }
  get UserLogSummaryRepo(): UserLogSummaryRepository {
    return this.userLogSummaryRepository;
  }

  get InventoryLogRepo(): EntityRepository<InventoryLog> {
    return this.inventoryLogRepository;
  }

  get AIAcceptanceRepo(): AIAcceptanceRepository {
    return this.aiAcceptanceRepository;
  }

  get AdminInstructionRepo(): AdminInstructionRepository {
    return this.adminInstructionRepository;
  }

  get ReviewLogRepo(): EntityRepository<ReviewLog> {
    return this.reviewLogRepository;
  }
}
