import { Common } from './common/common.entities';
import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { SurveyQuestionAnswerRepository } from 'src/infrastructure/domain/repositories/survey-question-answer.repository';
import { SurveyQuestionAnswerDetail } from './survey-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu bản ghi bài survey của người dùng (gồm nhiều chi tiết câu hỏi - câu trả lời) */
@Entity({ repository: () => SurveyQuestionAnswerRepository })
export class SurveyQuestionAnswer extends Common {
  /** ID người dùng làm survey */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property()
  userId!: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({ description: 'Danh sách chi tiết câu hỏi - câu trả lời', type: () => SurveyQuestionAnswerDetail, isArray: true })
  @OneToMany(() => SurveyQuestionAnswerDetail, (detail) => detail.quesAns, { orphanRemoval: true })
  details = new Collection<SurveyQuestionAnswerDetail>(this);

  constructor(init?: Partial<SurveyQuestionAnswer>) {
    super();
    Object.assign(this, init);
  }
}
