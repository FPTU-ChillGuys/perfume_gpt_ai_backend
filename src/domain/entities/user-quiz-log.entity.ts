import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { ManyToOne, OneToOne } from '@mikro-orm/core';
import { UserLog } from './user-log.entity';

export class UserQuizLog extends Common {
  @ApiProperty({ type: () => QuizQuestionAnswerDetail })
  @OneToOne(() => QuizQuestionAnswerDetail)
  quizQuesAnsDetail: QuizQuestionAnswerDetail;

  @ApiProperty({ type: () => UserLog })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserQuizLog>) {
    super();
    Object.assign(this, init);
  }
}
