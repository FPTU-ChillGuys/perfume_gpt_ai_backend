import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

@Injectable()
export class QuizQuestionRepository extends SqlEntityRepository<QuizQuestion> {}
