import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { ReviewSummaryLog } from 'src/domain/entities/review-summary-log.entity';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { Message } from 'src/domain/entities/message.entity';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestionAnswer } from 'src/domain/entities/survey-question-answer.entity';
import { SurveyQuestionAnswerDetail } from 'src/domain/entities/survey-question-answer-detail.entity';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';
import { UserLogSummary } from 'src/domain/entities/user-log-summary';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { TrendLog } from 'src/domain/entities/trend-log.entity';
import { EventLog } from 'src/domain/entities/event-log.entity';
import { VocabDictionary } from 'src/domain/entities/vocab/vocab-dictionary.entity';
import { VocabTerm } from 'src/domain/entities/vocab/vocab-term.entity';
import { VocabAlias } from 'src/domain/entities/vocab/vocab-alias.entity';
import { VocabAgeBucket } from 'src/domain/entities/vocab/vocab-age-bucket.entity';
import { VocabPhraseRule } from 'src/domain/entities/vocab/vocab-phrase-rule.entity';
import { VocabParserRule } from 'src/domain/entities/vocab/vocab-parser-rule.entity';
import { ProductEmbedding } from 'src/infrastructure/domain/hybrid-search/entities/product-embedding.entity';

export const entities = [
  Conversation,
  SurveyQuestion,
  SurveyQuestionAnswer,
  SurveyQuestionAnswerDetail,
  ReviewSummaryLog,
  AdminInstruction,
  Message,
  SurveyAnswer,
  UserLogSummary,
  AIAcceptance,
  InventoryLog,
  ReviewLog,
  TrendLog,
  EventLog,
  VocabDictionary,
  VocabTerm,
  VocabAlias,
  VocabAgeBucket,
  VocabPhraseRule,
  VocabParserRule,
  ProductEmbedding
];
