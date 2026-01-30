import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionRepository } from 'src/infrastructure/repositories/quiz-question.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ repository: () => QuizQuestionRepository })
export class QuizQuestion extends Common {
  @ApiProperty()
  @Property()
  question!: string;

  @ApiProperty({ type: () => QuizAnswer, isArray: true })
  @OneToMany(() => QuizAnswer, (quizAns) => quizAns.question)
  answers = new Collection<QuizAnswer>(this);

  @ApiProperty({ type: () => QuizQuestionAnswerDetail, isArray: true })
  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.question)
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestion>) {
    super();
    Object.assign(this, init);
  }
}
