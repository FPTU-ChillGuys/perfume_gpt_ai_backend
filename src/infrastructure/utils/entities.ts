import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { ReviewSummaryLog } from 'src/domain/entities/review-summary-log.entity';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { UserLogSummary } from 'src/domain/entities/user-log-summary';
import { UserLog } from 'src/domain/entities/user-log.entity';
import { UserMessageLog } from 'src/domain/entities/user-message-log.entity';
import { UserQuizLog } from 'src/domain/entities/user-quiz-log.entity';
import { UserSearchLog } from 'src/domain/entities/user-search.log.entity';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';

export const entities = [
  Conversation,
  QuizQuestion,
  QuizQuestionAnswer,
  ReviewSummaryLog,
  AdminInstruction,
  Message,
  QuizAnswer,
  UserLogSummary,
  UserLog,
  UserMessageLog,
  UserQuizLog,
  UserSearchLog,
  AIAcceptance,
  InventoryLog
];
