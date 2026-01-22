import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';

@Injectable()
export class QuizQuestionRepository extends SqlEntityRepository<QuizQuestionAnswer> {}
