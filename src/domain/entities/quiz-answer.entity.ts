import { QuizQuestion } from './quiz-question.entity';
import { Common } from './common/common.entities';
import { ManyToOne, Property } from '@mikro-orm/core';

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
}
