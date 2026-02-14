import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { Entity, ManyToOne } from '@mikro-orm/core';
import { UserLog } from './user-log.entity';

/** Entity lưu log quiz của người dùng - liên kết QuizQuestionAnswerDetail với UserLog */
@Entity()
export class UserQuizLog extends Common {
  /** Chi tiết câu hỏi - câu trả lời quiz (nếu có) */
  @ApiProperty({ description: 'Chi tiết quiz được ghi log', type: () => QuizQuestionAnswerDetail, nullable: true })
  @ManyToOne(() => QuizQuestionAnswerDetail, { nullable: true })
  quizQuesAnsDetail?: QuizQuestionAnswerDetail;

  /** Bản ghi user log cha */
  @ApiProperty({ description: 'User log cha', type: () => UserLog })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserQuizLog>) {
    super();
    Object.assign(this, init);
  }
}
