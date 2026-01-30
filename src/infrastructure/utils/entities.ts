import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

export const entities = [
  Conversation,
  QuizQuestion,
  QuizQuestionAnswer,
  // AIRequestResponse,
  AIReviewSummary
];
