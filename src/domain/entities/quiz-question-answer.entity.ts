import { Common } from './common/common.entities';
import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { QuizQuestionAnswerRepository } from 'src/infrastructure/repositories/quiz-question-answer.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';

@Entity({ repository: () => QuizQuestionAnswerRepository })
export class QuizQuestionAnswer extends Common {
  @Property()
  userId!: string;

  @OneToMany(() => QuizQuestionAnswerDetail, (detail) => detail.quesAns)
  details = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestionAnswer>) {
    super();
    Object.assign(this, init);
  }
}
