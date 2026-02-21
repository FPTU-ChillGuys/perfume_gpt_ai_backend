import { Collection, Entity, ManyToOne, OneToMany, OneToOne } from '@mikro-orm/core';
import { QuizQuestion } from './quiz-question.entity';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionAnswer } from './quiz-question-answer.entity';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { UserQuizLog } from './user-quiz-log.entity';

/** Entity lưu chi tiết từng cặp câu hỏi - câu trả lời mà người dùng đã chọn */
@Entity()
export class QuizQuestionAnswerDetail extends Common {
  /** Câu hỏi được trả lời */
  @ApiProperty({ description: 'Câu hỏi được trả lời', type: () => QuizQuestion })
  @ManyToOne(() => QuizQuestion, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  question!: QuizQuestion;

  /** Câu trả lời được chọn */
  @ApiProperty({ description: 'Câu trả lời được chọn', type: () => QuizAnswer })
  @ManyToOne(() => QuizAnswer, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  answer!: QuizAnswer;

  /** Bản ghi bài quiz chứa chi tiết này */
  @ApiProperty({ description: 'Bản ghi bài quiz cha', type: () => QuizQuestionAnswer })
  @ManyToOne(() => QuizQuestionAnswer, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  quesAns!: QuizQuestionAnswer;

  /** Log quiz của người dùng (nếu có) */
  @ApiProperty({ description: 'Log quiz của người dùng', type: () => UserQuizLog, nullable: true })
  @OneToMany(() => UserQuizLog, userQuizLog => userQuizLog.quizQuesAnsDetail, { orphanRemoval: true })
  userQuizLog? = new Collection<UserQuizLog>(this);

  constructor(init?: Partial<QuizQuestionAnswerDetail>) {
    super();
    Object.assign(this, init);
  }
}
