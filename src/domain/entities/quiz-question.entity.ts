import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionRepository } from 'src/infrastructure/repositories/quiz-question.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';

@Entity({ repository: () => QuizQuestionRepository })
export class QuizQuestion extends Common {
  @Property()
  question!: string;
  @OneToMany(() => QuizAnswer, (quizAns) => quizAns.question)
  answers = new Collection<QuizAnswer>(this);
  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.question)
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestion>) {
    super();
    Object.assign(this, init);
  }
}
