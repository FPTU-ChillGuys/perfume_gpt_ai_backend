import { Injectable } from '@nestjs/common';
import { AIConversationRepository } from './ai-conversation.repository';
import { AIQuizQuestionAnswerRepository } from './ai-quiz-question-answer.repository';
import { AIQuizQuestionRepository } from './ai-quiz-question.repository';
import { AIRequestResponseRepository } from './ai-request-response.repository';
import { AIReviewSummaryRepository } from './ai-review-summary.repository';

@Injectable()
export class UnitOfWork {
  constructor(
    private aiConversationRepository: AIConversationRepository,
    private aiQuizQuestionRepository: AIQuizQuestionRepository,
    private aiQuizQuestionAnswerRepository: AIQuizQuestionAnswerRepository,
    private aiRequestResponseRepository: AIRequestResponseRepository,
    private aiReviewSummaryRepository: AIReviewSummaryRepository
  ) {}

  get AIConversationRepo(): AIConversationRepository {
    return this.aiConversationRepository;
  }
  get AIQuizQuestionRepo(): AIQuizQuestionRepository {
    return this.aiQuizQuestionRepository;
  }
  get AIQuizQuestionAnswerRepo(): AIQuizQuestionAnswerRepository {
    return this.aiQuizQuestionAnswerRepository;
  }
  get AIRequestResponseRepo(): AIRequestResponseRepository {
    return this.aiRequestResponseRepository;
  }
  get AIReviewSummaryRepo(): AIReviewSummaryRepository {
    return this.aiReviewSummaryRepository;
  }
}
