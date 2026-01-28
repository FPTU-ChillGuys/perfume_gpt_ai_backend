import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

@Injectable()
export class QuizQuestionAnswerRepository extends SqlEntityRepository<QuizQuestionAnswer> {
  async createQuesAns(
    userId: string,
    questionId: string,
    answerId: string
  ): Promise<QuizQuestionAnswer> {
    const quizQuesAns = new QuizQuestionAnswer();
    const orm = this.getEntityManager();
    // Using getReference to avoid fetching the entire entity
    quizQuesAns.userId = userId;
    quizQuesAns.question = orm.getReference(QuizQuestion, questionId);
    quizQuesAns.answer = orm.getReference(QuizAnswer, answerId);
    // Persist and flush the new entity
    orm.persist(quizQuesAns);
    await orm.flush();
    return quizQuesAns;
  }
}
