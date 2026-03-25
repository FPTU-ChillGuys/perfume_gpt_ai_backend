import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { SurveyQuestionAnswerDetail } from './survey-question-answer-detail.entity';
import { Entity, ManyToOne } from '@mikro-orm/core';
import { UserLog } from './user-log.entity';

/** Entity lưu log survey của người dùng - liên kết SurveyQuestionAnswerDetail với UserLog */
@Entity()
export class UserSurveyLog extends Common {
  /** Chi tiết câu hỏi - câu trả lời survey (nếu có) */
  @ApiProperty({ description: 'Chi tiết survey được ghi log', type: () => SurveyQuestionAnswerDetail, nullable: true })
  @ManyToOne(() => SurveyQuestionAnswerDetail, { nullable: true })
  surveyQuesAnsDetail?: SurveyQuestionAnswerDetail;

  /** Bản ghi user log cha */
  @ApiProperty({ description: 'User log cha', type: () => UserLog })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserSurveyLog>) {
    super();
    Object.assign(this, init);
  }
}
