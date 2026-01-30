import { Common } from './common/common.entities';
import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { QuizQuestionAnswerRepository } from 'src/infrastructure/repositories/quiz-question-answer.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ repository: () => QuizQuestionAnswerRepository })
export class QuizQuestionAnswer extends Common {
  @ApiProperty()
  @Property()
  userId!: string;

  @ApiProperty({ type: () => QuizQuestionAnswerDetail, isArray: true })
  @OneToMany(() => QuizQuestionAnswerDetail, (detail) => detail.quesAns)
  details = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestionAnswer>) {
    super();
    Object.assign(this, init);
  }
}
