import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionRepository } from 'src/infrastructure/repositories/quiz-question.repository';
import { QuizQuestionAnswer } from './quiz-question-answer.entity';

@Entity({ repository: () => QuizQuestionRepository })
export class QuizQuestion extends Common {
  @Property()
  question!: string;
  @OneToMany(() => QuizAnswer, (quizAns) => quizAns.question)
  answers = new Collection<QuizAnswer>(this);
  @OneToMany(() => QuizQuestionAnswer, (qqa) => qqa.question)
  quizQuestionAnswers = new Collection<QuizQuestionAnswer>(this);

  constructor(init?: Partial<QuizQuestion>) {
    super();
    Object.assign(this, init);
  }
}
