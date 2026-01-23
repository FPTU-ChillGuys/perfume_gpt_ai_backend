import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { AdminInstruction } from './src/domain/entities/admin-instruction.entity';
import { AIRequestResponse } from './src/domain/entities/ai-request-response.entity';
import { AIReviewSummary } from './src/domain/entities/ai-review-summary.entity';
import { Conversation } from './src/domain/entities/conversation.entity';
import { Message } from './src/domain/entities/message.entity';
import { QuizAnswer } from './src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from './src/domain/entities/quiz-question-answer.entity';
import { QuizQuestion } from './src/domain/entities/quiz-question.entity';

export default defineConfig({
  // entitiesTs: [
  //   AdminInstruction,
  //   AIRequestResponse,
  //   AIReviewSummary,
  //   Conversation,
  //   Message,
  //   QuizAnswer,
  //   QuizQuestion,
  //   QuizQuestionAnswer
  // ],
  entities: [
    AdminInstruction,
    AIRequestResponse,
    AIReviewSummary,
    Conversation,
    Message,
    QuizAnswer,
    QuizQuestion,
    QuizQuestionAnswer
  ],
  extensions: [EntityGenerator, Migrator],
  metadataProvider: TsMorphMetadataProvider,
  dbName: 'perfume_gpt_ai',
  user: 'vqn',
  password: '1234567890',
  host: 'localhost',
  port: 5432
});
