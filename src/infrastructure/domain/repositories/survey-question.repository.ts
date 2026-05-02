import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';

@Injectable()
export class SurveyQuestionRepository extends SqlEntityRepository<SurveyQuestion> {
  async createWithAnswers(
    request: SurveyQuestionRequest
  ): Promise<SurveyQuestion> {
    const em = this.getEntityManager();

    let order = request.order;
    if (order === undefined || order === null) {
      const maxResult = await em.findOne(
        SurveyQuestion,
        { isActive: true },
        {
          orderBy: { order: 'DESC' },
          fields: ['order']
        }
      );
      order = (maxResult?.order ?? -1) + 1;
    }

    const surveyQuestion = new SurveyQuestion({
      question: request.question,
      questionType: request.questionType,
      order
    });

    surveyQuestion.answers.set(
      request.answers.map(
        (ansReq) =>
          new SurveyAnswer({
            answer: ansReq.answer,
            question: surveyQuestion
          })
      )
    );

    em.persist(surveyQuestion);
    await em.flush();

    return surveyQuestion;
  }

  async updateWithAnswers(
    surveyQuestion: SurveyQuestion,
    answers: SurveyAnswerRequest[]
  ): Promise<SurveyQuestion> {
    const em = this.getEntityManager();

    surveyQuestion.surveyQuestionAnswers.removeAll();

    surveyQuestion.answers.set(
      answers.map(
        (ansReq) =>
          new SurveyAnswer({
            answer: ansReq.answer,
            question: surveyQuestion
          })
      )
    );

    em.persist(surveyQuestion);
    await em.flush();
    return surveyQuestion;
  }

  async softDeleteQuestion(id: string): Promise<SurveyQuestion | null> {
    const em = this.getEntityManager();

    const surveyQuestion = await this.findOne(
      { id, isActive: true },
      { populate: ['answers'] }
    );
    if (!surveyQuestion) return null;

    // Soft delete question
    surveyQuestion.isActive = false;

    // Soft delete all related answers
    for (const answer of surveyQuestion.answers.getItems()) {
      answer.isActive = false;
    }

    await em.flush();
    return surveyQuestion;
  }

  async rebuildOrder(): Promise<void> {
    const em = this.getEntityManager();
    const questions = await this.find(
      { isActive: true },
      { orderBy: { order: 'ASC' } }
    );
    for (let i = 0; i < questions.length; i++) {
      questions[i].order = i + 1;
    }
    await em.flush();
  }
}
