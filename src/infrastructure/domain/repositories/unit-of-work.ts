import { Injectable } from '@nestjs/common';
import { AdminInstructionRepository } from './admin-instruction.repository';
import { ConversationRepository } from './conversation.repository';
import { SurveyQuestionAnswerRepository } from './survey-question-answer.repository';
import { SurveyQuestionRepository } from './survey-question.repository';
import { UserLogSummaryRepository } from './user-log-summary.repository';
import { AIAcceptanceRepository } from './ai-acceptance.repository';
import { ReviewSummaryLogRepository } from './review-summary.repository';
import { InventoryLogRepository } from './inventory-log.repository';
import { TrendLogRepository } from './trend-log.repository';
import { EventLogRepository } from './event-log.repository';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ReviewLog } from 'src/domain/entities/review-log.entity';

@Injectable()
export class UnitOfWork {
  constructor(
    private readonly aiConversationRepository: ConversationRepository,
    private readonly aiSurveyQuestionRepository: SurveyQuestionRepository,
    private readonly aiSurveyQuestionAnswerRepository: SurveyQuestionAnswerRepository,
    private readonly eventLogRepository: EventLogRepository,
    private readonly reviewSummaryLogRepository: ReviewSummaryLogRepository,
    private readonly userLogSummaryRepository: UserLogSummaryRepository,
    private readonly aiAcceptanceRepository: AIAcceptanceRepository,
    private readonly adminInstructionRepository: AdminInstructionRepository,
    private readonly inventoryLogRepository: InventoryLogRepository,
    private readonly trendLogRepository: TrendLogRepository,
    @InjectRepository(ReviewLog)
    private readonly reviewLogRepository: EntityRepository<ReviewLog>
  ) {}

  get AIConversationRepo(): ConversationRepository {
    return this.aiConversationRepository;
  }
  get AISurveyQuestionRepo(): SurveyQuestionRepository {
    return this.aiSurveyQuestionRepository;
  }
  get AISurveyQuestionAnswerRepo(): SurveyQuestionAnswerRepository {
    return this.aiSurveyQuestionAnswerRepository;
  }
  get EventLogRepo(): EventLogRepository {
    return this.eventLogRepository;
  }
  get ReviewSummaryLogRepo(): ReviewSummaryLogRepository {
    return this.reviewSummaryLogRepository;
  }
  get UserLogSummaryRepo(): UserLogSummaryRepository {
    return this.userLogSummaryRepository;
  }

  get InventoryLogRepo(): InventoryLogRepository {
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

  get TrendLogRepo(): TrendLogRepository {
    return this.trendLogRepository;
  }
}
