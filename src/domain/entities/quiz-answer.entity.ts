import { QuizQuestion } from './quiz-question.entity';
import { Common } from './common/common.entities';
import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property
} from '@mikro-orm/core';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';

@Entity()
export class QuizAnswer extends Common {
  @Property()
  answer!: string;

  @ManyToOne(() => QuizQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;

  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.answer)
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizAnswer>) {
    super();
    Object.assign(this, init);
  }
}
