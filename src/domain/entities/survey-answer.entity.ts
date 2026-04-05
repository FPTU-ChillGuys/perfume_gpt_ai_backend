import { SurveyQuestion } from './survey-question.entity';
import { Common } from './common/common.entities';
import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property
} from '@mikro-orm/core';
import { SurveyQuestionAnswerDetail } from './survey-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu câu trả lời cho câu hỏi survey */
@Entity()
export class SurveyAnswer extends Common {
  /** Nội dung câu trả lời */
  @ApiProperty({ description: 'Nội dung câu trả lời', type: 'string' })
  @Property({ type: 'text' })
  answer!: string;

  /** Câu hỏi chứa câu trả lời này */
  @ApiProperty({ description: 'Câu hỏi liên quan', type: () => SurveyQuestion })
  @ManyToOne(() => SurveyQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: SurveyQuestion;

  /** Danh sách chi tiết bài survey liên kết với câu trả lời này */
  @ApiProperty({ description: 'Danh sách chi tiết bài survey', type: () => SurveyQuestionAnswerDetail, isArray: true })
  @OneToMany(() => SurveyQuestionAnswerDetail, (qqa) => qqa.answer, { orphanRemoval: true })
  surveyQuestionAnswers = new Collection<SurveyQuestionAnswerDetail>(this);

  constructor(init?: Partial<SurveyAnswer>) {
    super();
    Object.assign(this, init);
  }
}
