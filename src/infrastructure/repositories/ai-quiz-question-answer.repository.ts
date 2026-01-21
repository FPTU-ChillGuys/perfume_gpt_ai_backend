import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AIQuizQuestionAnswer } from 'src/domain/entities/ai-quiz-question-answer.entity';

@Injectable()
export class AIQuizQuestionAnswerRepository extends SqlEntityRepository<AIQuizQuestionAnswer> {}
