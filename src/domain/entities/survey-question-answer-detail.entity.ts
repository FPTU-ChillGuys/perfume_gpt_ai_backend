import { Entity, ManyToOne, OneToOne } from '@mikro-orm/core';
import { SurveyQuestion } from './survey-question.entity';
import { SurveyAnswer } from './survey-answer.entity';
import { SurveyQuestionAnswer } from './survey-question-answer.entity';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu chi tiết từng cặp câu hỏi - câu trả lời mà người dùng đã chọn */
@Entity()
export class SurveyQuestionAnswerDetail extends Common {
  /** Câu hỏi được trả lời */
  @ApiProperty({
    description: 'Câu hỏi được trả lời',
    type: () => SurveyQuestion
  })
  @ManyToOne(() => SurveyQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: SurveyQuestion;

  /** Câu trả lời được chọn */
  @ApiProperty({
    description: 'Câu trả lời được chọn',
    type: () => SurveyAnswer
  })
  @ManyToOne(() => SurveyAnswer, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  answer!: SurveyAnswer;

  /** Bản ghi bài survey chứa chi tiết này */
  @ApiProperty({
    description: 'Bản ghi bài survey cha',
    type: () => SurveyQuestionAnswer
  })
  @ManyToOne(() => SurveyQuestionAnswer, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  quesAns!: SurveyQuestionAnswer;

  constructor(init?: Partial<SurveyQuestionAnswerDetail>) {
    super();
    Object.assign(this, init);
  }
}
