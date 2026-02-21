import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

@Injectable()
export class QuizQuestionRepository extends SqlEntityRepository<QuizQuestion> {
  async createWithAnswers(request: QuizQuestionRequest): Promise<QuizQuestion> {
    const quizQuestion = new QuizQuestion({
      question: request.question
    });

    quizQuestion.answers.set(
      request.answers.map(
        (ansReq) =>
          new QuizAnswer({
            answer: ansReq.answer,
            question: quizQuestion // owning side
          })
      )
    );

    const em = this.getEntityManager();
    em.persist(quizQuestion);
    await em.flush();

    return quizQuestion;
  }

  async updateWithAnswers(
    quizQuestion: QuizQuestion,
    answers: QuizAnswerRequest[]
  ): Promise<QuizQuestion> {
    const em = this.getEntityManager();

    quizQuestion.quizQuestionAnswers.removeAll(); // Remove existing answers

    quizQuestion.answers.set(
      answers.map(
        (ansReq) =>
          new QuizAnswer({
            answer: ansReq.answer,
            question: quizQuestion // owning side
          })
      )
    );

    em.persist(quizQuestion);
    await em.flush();
    return quizQuestion;
  }
}
