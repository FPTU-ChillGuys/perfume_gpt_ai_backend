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
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class QuizAnswer extends Common {
  @ApiProperty()
  @Property()
  answer!: string;

  @ApiProperty({type: () => QuizQuestion})
  @ManyToOne(() => QuizQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;

  @ApiProperty({ type: () => QuizQuestionAnswerDetail, isArray: true })
  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.answer)
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizAnswer>) {
    super();
    Object.assign(this, init);
  }
}
