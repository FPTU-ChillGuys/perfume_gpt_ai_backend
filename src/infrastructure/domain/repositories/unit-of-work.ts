import { Injectable } from '@nestjs/common';
import { AdminInstructionRepository } from './admin-instruction.repository';
import { ConversationRepository } from './conversation.repository';
import { SurveyQuestionAnswerRepository } from './survey-question-answer.repository';
import { SurveyQuestionRepository } from './survey-question.repository';
import { UserLogSummaryRepository } from './user-log-summary.repository';
import { AIAcceptanceRepository } from './ai-acceptance.repository';
import { ReviewSummaryLogRepository } from './review-summary.repository';
import { InventoryLogRepository } from './inventory-log.repository';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { TrendLog } from 'src/domain/entities/trend-log.entity';
import { EventLogRepository } from './event-log.repository';

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
    @InjectRepository(ReviewLog) private readonly reviewLogRepository: EntityRepository<ReviewLog>,
    @InjectRepository(TrendLog) private readonly trendLogRepository: EntityRepository<TrendLog>
  ) { }

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

  get TrendLogRepo(): EntityRepository<TrendLog> {
    return this.trendLogRepository;
  }
}
