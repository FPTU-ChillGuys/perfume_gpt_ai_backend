import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { AIQuizQuestionAnswer } from 'src/domain/entities/ai-quiz-question-answer.entity';

export class AIQuizQuestionAnswerRepository extends SqlEntityRepository<AIQuizQuestionAnswer> {}
