import { Common } from './common/common.entities';
import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { QuizQuestionAnswerRepository } from 'src/infrastructure/repositories/quiz-question-answer.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu bản ghi bài quiz của người dùng (gồm nhiều chi tiết câu hỏi - câu trả lời) */
@Entity({ repository: () => QuizQuestionAnswerRepository })
export class QuizQuestionAnswer extends Common {
  /** ID người dùng làm quiz */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property()
  userId!: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({ description: 'Danh sách chi tiết câu hỏi - câu trả lời', type: () => QuizQuestionAnswerDetail, isArray: true })
  @OneToMany(() => QuizQuestionAnswerDetail, (detail) => detail.quesAns)
  details = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestionAnswer>) {
    super();
    Object.assign(this, init);
  }
}
