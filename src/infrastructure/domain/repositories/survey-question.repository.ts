import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';

@Injectable()
export class SurveyQuestionRepository extends SqlEntityRepository<SurveyQuestion> {
  async createWithAnswers(request: SurveyQuestionRequest): Promise<SurveyQuestion> {
    const surveyQuestion = new SurveyQuestion({
      question: request.question,
      questionType: request.questionType
    });

    surveyQuestion.answers.set(
      request.answers.map(
        (ansReq) =>
          new SurveyAnswer({
            answer: ansReq.answer,
            question: surveyQuestion // owning side
          })
      )
    );

    const em = this.getEntityManager();
    em.persist(surveyQuestion);
    await em.flush();

    return surveyQuestion;
  }

  async updateWithAnswers(
    surveyQuestion: SurveyQuestion,
    answers: SurveyAnswerRequest[]
  ): Promise<SurveyQuestion> {
    const em = this.getEntityManager();

    surveyQuestion.surveyQuestionAnswers.removeAll(); // Remove existing answers

    surveyQuestion.answers.set(
      answers.map(
        (ansReq) =>
          new SurveyAnswer({
            answer: ansReq.answer,
            question: surveyQuestion // owning side
          })
      )
    );

    em.persist(surveyQuestion);
    await em.flush();
    return surveyQuestion;
  }

  /** Soft delete câu hỏi và tất cả câu trả lời liên quan */
  async softDeleteQuestion(id: string): Promise<SurveyQuestion | null> {
    const em = this.getEntityManager();

    const surveyQuestion = await this.findOne({ id, isActive: true }, { populate: ['answers'] });
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
}
