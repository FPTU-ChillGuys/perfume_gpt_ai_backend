import { Injectable } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { QuizQuestionAnswerRepository } from './quiz-question-answer.repository';
import { QuizQuestionRepository } from './quiz-question.repository';
import { AIRequestResponseRepository } from './ai-request-response.repository';
import { AIReviewSummaryRepository } from './review-summary.repository';

@Injectable()
export class UnitOfWork {
  constructor(
    private aiConversationRepository: ConversationRepository,
    private aiQuizQuestionRepository: QuizQuestionRepository,
    private aiQuizQuestionAnswerRepository: QuizQuestionAnswerRepository,
    private aiRequestResponseRepository: AIRequestResponseRepository,
    private aiReviewSummaryRepository: AIReviewSummaryRepository
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
  get AIRequestResponseRepo(): AIRequestResponseRepository {
    return this.aiRequestResponseRepository;
  }
  get AIReviewSummaryRepo(): AIReviewSummaryRepository {
    return this.aiReviewSummaryRepository;
  }
}
