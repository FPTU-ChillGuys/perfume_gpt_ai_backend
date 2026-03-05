import { Collection, Entity, Enum, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionRepository } from 'src/infrastructure/repositories/quiz-question.repository';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Loại câu hỏi quiz */
export enum QuestionType {
  SINGLE = 'single',
  MULTIPLE = 'multiple'
}

/** Entity lưu câu hỏi quiz */
@Entity({ repository: () => QuizQuestionRepository })
export class QuizQuestion extends Common {
  /** Loại câu hỏi (chọn 1 hoặc nhiều đáp án) */
  @ApiProperty({ description: 'Loại câu hỏi', enum: QuestionType, default: QuestionType.SINGLE })
  @Enum({ items: () => QuestionType, default: QuestionType.SINGLE })
  questionType: QuestionType = QuestionType.SINGLE;

  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi' })
  @Property()
  question!: string;

  /** Danh sách câu trả lời của câu hỏi */
  @ApiProperty({
    description: 'Danh sách câu trả lời',
    type: () => QuizAnswer,
    isArray: true
  })
  @OneToMany(() => QuizAnswer, (quizAns) => quizAns.question, {
    orphanRemoval: true
  })
  answers = new Collection<QuizAnswer>(this);

  /** Danh sách chi tiết bài quiz liên quan */
  @ApiProperty({
    description: 'Danh sách chi tiết bài quiz',
    type: () => QuizQuestionAnswerDetail,
    isArray: true
  })
  @OneToMany(() => QuizQuestionAnswerDetail, (qqa) => qqa.question, { orphanRemoval: true })
  quizQuestionAnswers = new Collection<QuizQuestionAnswerDetail>(this);

  constructor(init?: Partial<QuizQuestion>) {
    super();
    Object.assign(this, init);
  }
}
