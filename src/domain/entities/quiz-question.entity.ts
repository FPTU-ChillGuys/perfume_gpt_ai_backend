import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionRepository } from 'src/infrastructure/repositories/quiz-question.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu câu hỏi quiz */
@Entity({ repository: () => QuizQuestionRepository })
export class QuizQuestion extends Common {
  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi' })
  @Property()
  question!: string;

  /** Danh sách câu trả lời của câu hỏi */
  @ApiProperty({ description: 'Danh sách câu trả lời', type: () => QuizAnswer, isArray: true })
  @OneToMany(() => QuizAnswer, (quizAns) => quizAns.question)
  answers = new Collection<QuizAnswer>(this);

  /** Danh sách chi tiết bài quiz liên quan */
  @ApiProperty({ description: 'Danh sách chi tiết bài quiz', type: () => QuizQuestionAnswerDetail, isArray: true })
  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.question)
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestion>) {
    super();
    Object.assign(this, init);
  }
}
