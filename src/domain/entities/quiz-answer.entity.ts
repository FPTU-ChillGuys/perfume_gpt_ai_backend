import { QuizQuestion } from './quiz-question.entity';
import { Common } from './common/common.entities';
import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property
} from '@mikro-orm/core';
import { QuizQuestionAnswer } from './quiz-question-answer.entity';

@Entity()
export class QuizAnswer extends Common {
  @Property()
  questionId!: string;
  @Property()
  answer!: string;
  @ManyToOne(() => QuizQuestion, {
    fieldName: 'questionId',
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;

  @OneToMany(() => QuizQuestionAnswer, (qqa) => qqa.answer)
  quizQuestionAnswers = new Collection<QuizQuestionAnswer>(this);

  constructor(init?: Partial<QuizAnswer>) {
    super();
    Object.assign(this, init);
  }
}
