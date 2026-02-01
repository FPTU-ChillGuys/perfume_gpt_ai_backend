import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Message } from 'src/domain/entities/message.entity';
import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { UserLog } from 'src/domain/entities/user-log.entity';
import { UserMessageLog } from 'src/domain/entities/user-message-log.entity';
import { UserQuizLog } from 'src/domain/entities/user-quiz-log.entity';
import { UserSearchLog } from 'src/domain/entities/user-search.log.entity';

@Injectable()
export class UserLogRepository extends SqlEntityRepository<UserLog> {
  em = this.getEntityManager();

  createUserLog(userId: string): UserLog {
    const userLog = new UserLog();
    userLog.userId = userId;
    this.em.persist(userLog).flush();
    return userLog;
  }

  getUserLogByUserId(userId: string): Promise<UserLog | null> {
    return this.findOne({ userId });
  }

  async addMessageLogToUserLog(userId: string, message: Message) {
    const userLog = await this.findOneOrFail({ userId });
    userLog.userMessageLogs.add(
      new UserMessageLog({ message, userLog })
    );
    await this.em.flush();
    return userLog.userMessageLogs.getItems();
  }

  async getUserLogsWithMessages(userId: string): Promise<UserLog | null> {
    return this.findOne(
      { userId },
      { populate: ['userMessageLogs', 'userMessageLogs.message'] }
    );
  }

  async addQuizQuesAnsDetailLogToUserLog(
    userId: string,
    quizQuesAnsDetail: QuizQuestionAnswerDetail
  ) {
    const userLog = await this.findOneOrFail({ userId });
    userLog.userQuizLogs.add(
      new UserQuizLog({ quizQuesAnsDetail, userLog })
    );
    await this.em.flush();
    return userLog.userQuizLogs.getItems();
  }

  async getUserLogsWithQuizDetails(userId: string): Promise<UserLog | null> {
    return this.findOne(
      { userId },
      { populate: ['userQuizLogs', 'userQuizLogs.quizQuesAnsDetail'] }
    );
  }

  async addSearchLogToUserLog(userId: string, searchLog: string) {
    const userLog = await this.findOneOrFail({ userId });
    userLog.userSearchLogs.add(
      new UserSearchLog({ content: searchLog, userLog })
    );
    await this.em.flush();
    return userLog.userSearchLogs.getItems();
  }

  async saveUserLog(userLog: UserLog): Promise<void> {
    this.em.persist(userLog);
    await this.em.flush();
  }
}
