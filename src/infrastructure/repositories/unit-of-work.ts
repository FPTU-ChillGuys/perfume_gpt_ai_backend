import { Injectable } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { QuizQuestionAnswerRepository } from './quiz-question-answer.repository';
import { QuizQuestionRepository } from './quiz-question.repository';
import { AIReviewSummaryRepository } from './review-summary.repository';
import { UserLogRepository } from './user-log.repository';
import { UserLogSummaryRepository } from './user-log-summary.repository';
import { AIAcceptanceRepository } from './ai-acceptance.repository';

@Injectable()
export class UnitOfWork {
  constructor(
    private readonly aiConversationRepository: ConversationRepository,
    private readonly aiQuizQuestionRepository: QuizQuestionRepository,
    private readonly aiQuizQuestionAnswerRepository: QuizQuestionAnswerRepository,
    private readonly userLogRepository: UserLogRepository,
    private readonly aiReviewSummaryRepository: AIReviewSummaryRepository,
    private readonly userLogSummaryRepository: UserLogSummaryRepository,
    private readonly aiAcceptanceRepository: AIAcceptanceRepository
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
  get AIReviewSummaryRepo(): AIReviewSummaryRepository {
    return this.aiReviewSummaryRepository;
  }
  get UserLogSummaryRepo(): UserLogSummaryRepository {
    return this.userLogSummaryRepository;
  }

  get AIAcceptanceRepo(): AIAcceptanceRepository {
    return this.aiAcceptanceRepository;
  }
}
