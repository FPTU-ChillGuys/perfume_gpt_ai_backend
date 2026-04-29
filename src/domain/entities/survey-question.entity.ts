import { Collection, Entity, Enum, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { SurveyAnswer } from './survey-answer.entity';
import { SurveyQuestionRepository } from 'src/infrastructure/domain/repositories/survey-question.repository';
import { SurveyQuestionAnswerDetail } from './survey-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Loại câu hỏi survey */
export enum QuestionType {
  SINGLE = 'single',
  MULTIPLE = 'multiple'
}

/** Entity lưu câu hỏi survey */
@Entity({ repository: () => SurveyQuestionRepository })
export class SurveyQuestion extends Common {
  /** Loại câu hỏi (chọn 1 hoặc nhiều đáp án) */
  @ApiProperty({ description: 'Loại câu hỏi', enum: QuestionType, default: QuestionType.SINGLE })
  @Enum({ items: () => QuestionType, default: QuestionType.SINGLE })
  questionType: QuestionType = QuestionType.SINGLE;

  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi' })
  @Property()
  question!: string;

  @ApiProperty({ description: 'Thứ tự hiển thị câu hỏi', default: 0 })
  @Property({ type: 'number', default: 0 })
  order: number = 0;

  /** Danh sách câu trả lời của câu hỏi */
  @ApiProperty({
    description: 'Danh sách câu trả lời',
    type: () => SurveyAnswer,
    isArray: true
  })
  @OneToMany(() => SurveyAnswer, (surveyAns) => surveyAns.question, {
    orphanRemoval: true
  })
  answers = new Collection<SurveyAnswer>(this);

  /** Danh sách chi tiết bài survey liên quan */
  @ApiProperty({
    description: 'Danh sách chi tiết bài survey',
    type: () => SurveyQuestionAnswerDetail,
    isArray: true
  })
  @OneToMany(() => SurveyQuestionAnswerDetail, (qqa) => qqa.question, { orphanRemoval: true })
  surveyQuestionAnswers = new Collection<SurveyQuestionAnswerDetail>(this);

  constructor(init?: Partial<SurveyQuestion>) {
    super();
    Object.assign(this, init);
  }
}
