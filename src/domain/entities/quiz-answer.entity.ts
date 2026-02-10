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

/** Entity lưu câu trả lời cho câu hỏi quiz */
@Entity()
export class QuizAnswer extends Common {
  /** Nội dung câu trả lời */
  @ApiProperty({ description: 'Nội dung câu trả lời', type: 'string' })
  @Property({ type: 'text' })
  answer!: string;

  /** Câu hỏi chứa câu trả lời này */
  @ApiProperty({ description: 'Câu hỏi liên quan', type: () => QuizQuestion })
  @ManyToOne(() => QuizQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;

  /** Danh sách chi tiết bài quiz liên kết với câu trả lời này */
  @ApiProperty({ description: 'Danh sách chi tiết bài quiz', type: () => QuizQuestionAnswerDetail, isArray: true })
  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.answer)
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizAnswer>) {
    super();
    Object.assign(this, init);
  }
}
