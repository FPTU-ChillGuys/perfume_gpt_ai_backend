import { Entity, ManyToOne, OneToOne } from '@mikro-orm/core';
import { QuizQuestion } from './quiz-question.entity';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionAnswer } from './quiz-question-answer.entity';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { UserQuizLog } from './user-quiz-log.entity';

@Entity()
export class QuizQuestionAnswerDetail extends Common {
  @ApiProperty({type: () => QuizQuestion})
  @ManyToOne(() => QuizQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;
  @ApiProperty({type: () => QuizAnswer})
  @ManyToOne(() => QuizAnswer, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  answer!: QuizAnswer;

  @ApiProperty({type: () => QuizQuestionAnswer})
  @ManyToOne(() => QuizQuestionAnswer, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  quesAns!: QuizQuestionAnswer;

  @ApiProperty({ type: () => UserQuizLog, nullable: true  })
  @OneToOne(() => UserQuizLog, { nullable: true })
  userQuizLog?: UserQuizLog;

  constructor(init?: Partial<QuizQuestionAnswerDetail>) {
    super();
    Object.assign(this, init);
  }
}
