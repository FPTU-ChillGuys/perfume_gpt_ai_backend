import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

@Injectable()
export class QuizQuestionAnswerRepository extends SqlEntityRepository<QuizQuestionAnswer> {
  async createQuesAns(
    quizQuestionAnswer: QuizQuestionAnswer,
  ): Promise<QuizQuestionAnswer> {
    const orm = this.getEntityManager();
    orm.persist(quizQuestionAnswer);
    await orm.flush();
    return quizQuestionAnswer;
  }
}
