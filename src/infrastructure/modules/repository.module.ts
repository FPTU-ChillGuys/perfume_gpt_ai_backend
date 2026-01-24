import { ConversationRepository } from '../repositories/conversation.repository';
import { QuizQuestionRepository } from '../repositories/quiz-question.repository';
import { QuizQuestionAnswerRepository } from '../repositories/quiz-question-answer.repository';
import { AIRequestResponseRepository } from '../repositories/ai-request-response.repository';
import { AIReviewSummaryRepository } from '../repositories/review-summary.repository';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    ConversationRepository,
    QuizQuestionRepository,
    QuizQuestionAnswerRepository,
    AIRequestResponseRepository,
    AIReviewSummaryRepository
  ],
  exports: [
    ConversationRepository,
    QuizQuestionRepository,
    QuizQuestionAnswerRepository,
    AIRequestResponseRepository,
    AIReviewSummaryRepository
  ]
})
export class RepositoryModule {}
