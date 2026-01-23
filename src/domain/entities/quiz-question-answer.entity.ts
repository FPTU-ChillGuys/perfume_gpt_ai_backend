import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestion } from './quiz-question.entity';
import { Common } from './common/common.entities';
import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { QuizQuestionAnswerRepository } from 'src/infrastructure/repositories/quiz-question-answer.repository';

@Entity({ repository: () => QuizQuestionAnswerRepository })
export class QuizQuestionAnswer extends Common {
  @Property()
  userId!: string;
  @Property()
  questionId!: string;
  @Property()
  answerId!: string;
  @Property()
  ai_result!: string;
  @ManyToOne(() => QuizQuestion, {
    fieldName: 'questionId',
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;
  @ManyToOne(() => QuizAnswer, {
    fieldName: 'answerId',
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  anwser!: QuizAnswer;
}
