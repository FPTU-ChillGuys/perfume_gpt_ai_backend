import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { QuizAnswerRequest } from 'src/application/dtos/request/add-quiz-answer.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/add-quiz-question.request';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

@Injectable()
export class QuizQuestionRepository extends SqlEntityRepository<QuizQuestion> {
  async createWithAnswers(request: QuizQuestionRequest): Promise<QuizQuestion> {
    const quizQuestion = new QuizQuestion({
      question: request.question
    });

    request.answers.forEach((ansReq) => {
      quizQuestion.answers.add(
        new QuizAnswer({
          answer: ansReq.answer,
          question: quizQuestion // owning side
        })
      );
    });

    const em = this.getEntityManager();
    em.persist(quizQuestion);
    await em.flush();

    return quizQuestion;
  }

  async updateWithAnswers(
    id: string,
    question: string,
    answers: QuizAnswerRequest[]
  ): Promise<QuizQuestion> {
    const quizQuestion = await this.findOneOrFail({ id });

    if (!quizQuestion) {
      throw new Error('Quiz question not found');
    }

    quizQuestion.question = question;

    // Clear existing answers
    quizQuestion.answers.removeAll();
    // Add new answers
    answers.forEach((ansReq) => {
      quizQuestion.answers.add(
        new QuizAnswer({
          answer: ansReq.answer,
          question: quizQuestion // owning side
        })
      );
    });
    const em = this.getEntityManager();
    em.persist(quizQuestion);
    await em.flush();
    return quizQuestion;
  }
}
