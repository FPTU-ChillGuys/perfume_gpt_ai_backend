import { Entity, ManyToOne } from '@mikro-orm/core';
import { QuizQuestion } from './quiz-question.entity';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionAnswer } from './quiz-question-answer.entity';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

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
}
