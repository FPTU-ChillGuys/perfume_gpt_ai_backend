import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { QuizQuestionAnswerDetail } from './quiz-question-answer-detail.entity';
import { Entity, ManyToOne, OneToOne } from '@mikro-orm/core';
import { UserLog } from './user-log.entity';
import { nullable } from 'zod';

@Entity()
export class UserQuizLog extends Common {
  @ApiProperty({ type: () => QuizQuestionAnswerDetail, nullable: true })
  @OneToOne(() => QuizQuestionAnswerDetail, { nullable: true })
  quizQuesAnsDetail?: QuizQuestionAnswerDetail;

  @ApiProperty({ type: () => UserLog  })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserQuizLog>) {
    super();
    Object.assign(this, init);
  }
}
