import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Message } from 'src/domain/entities/message.entity';
import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { UserLog } from 'src/domain/entities/user-log.entity';
import { UserMessageLog } from 'src/domain/entities/user-message-log.entity';
import { UserQuizLog } from 'src/domain/entities/user-quiz-log.entity';
import { UserSearchLog } from 'src/domain/entities/user-search.log.entity';
import { AllUserLogRequest } from 'src/application/dtos/request/user-log.request';
import { endOfDay, startOfDay } from 'date-fns';

@Injectable()
export class UserLogRepository extends SqlEntityRepository<UserLog> {
  em = this.getEntityManager().fork();

  createUserLog(userId: string): UserLog {
    const userLog = new UserLog();
    userLog.userId = userId;
    this.em.persist(userLog).flush();
    return userLog;
  }

  async createUserLogIfNotExists(userId: string): Promise<UserLog> {
    const existingLog = await this.findOne({ userId });
    if (existingLog) {
      return existingLog;
    }
    return this.createUserLog(userId);
  }

  getUserLogByUserId(userId: string): Promise<UserLog | null> {
    return this.findOne(
      { userId },
      {
        populate: [
          'userMessageLogs',
          'userMessageLogs.message',
          'userQuizLogs',
          'userQuizLogs.quizQuesAnsDetail',
          'userQuizLogs.quizQuesAnsDetail.question',
          'userQuizLogs.quizQuesAnsDetail.answer',
          'userSearchLogs'
        ]
      }
    );
  }

  async addMessageLogToUserLog(userId: string, message: Message) {
    let userLog = await this.findOne({ userId });
    if (!userLog) {
      userLog = this.createUserLog(userId);
    }
    userLog.userMessageLogs.add(new UserMessageLog({ message, userLog }));
    await this.em.flush();
    const messageLogs =
      (
        await this.getUserLogsWithMessages(userId)
      )?.userMessageLogs.getItems() || [];
    return messageLogs;
  }

  async getUserLogsWithMessages(userId: string): Promise<UserLog | null> {
    return this.findOne(
      { userId },
      { populate: ['userMessageLogs', 'userMessageLogs.message'] }
    );
  }

  async getAllUserLogs(): Promise<UserLog[]> {
    return this.findAll({
      populate: [
        'userMessageLogs',
        'userMessageLogs.message',
        'userQuizLogs',
        'userQuizLogs.quizQuesAnsDetail',
        'userQuizLogs.quizQuesAnsDetail.question',
        'userQuizLogs.quizQuesAnsDetail.answer',
        'userSearchLogs'
      ]
    });
  }

  async getUserLogsWithPeriod(allUserLogRequest: AllUserLogRequest): Promise<UserLog[]> {
    return this.findAll({
      populate: [
        'userMessageLogs',
        'userMessageLogs.message',
        'userQuizLogs',
        'userQuizLogs.quizQuesAnsDetail',
        'userQuizLogs.quizQuesAnsDetail.question',
        'userQuizLogs.quizQuesAnsDetail.answer',
        'userSearchLogs'
      ],
      where: {
        createdAt: {
          $gte: startOfDay(allUserLogRequest.startDate!),
          $lte: endOfDay(allUserLogRequest.endDate)
        }
      }
    });
  }

  async addQuizQuesAnsDetailLogToUserLog(
    userId: string,
    quizQuesAnsDetails: QuizQuestionAnswerDetail[]
  ) {
    let userLog = await this.findOne({ userId });
    if (!userLog) {
      userLog = this.createUserLog(userId);
    }

    for (const quizQuesAnsDetail of quizQuesAnsDetails) {
      const existingQuizLog = await this.em.findOne(UserQuizLog, {
        quizQuesAnsDetail: quizQuesAnsDetail.id
      });

      if (!existingQuizLog) {
        userLog.userQuizLogs.add(new UserQuizLog({ quizQuesAnsDetail, userLog }));
        await this.em.flush();
      }
    }

    await userLog.userQuizLogs.init();
    return userLog.userQuizLogs.getItems();
  }

  async addQuizQuesAnsDetailsLogToUserLog(
    userId: string,
    quizQuesAnsDetails: QuizQuestionAnswerDetail[]
  ) {
    let userLog = await this.findOne({ userId });
    if (!userLog) {
      userLog = this.createUserLog(userId);
    }

    const detailIds = quizQuesAnsDetails.map((item) => item.id);
    const existingQuizLogs = await this.em.find(UserQuizLog, {
      quizQuesAnsDetail: { $in: detailIds }
    });
    const existingDetailIds = new Set(
      existingQuizLogs.map((item) => item.quizQuesAnsDetail!.id)
    );

    const addedInRequest = new Set<string>();
    quizQuesAnsDetails.forEach((quizQuesAnsDetail) => {
      if (
        !existingDetailIds.has(quizQuesAnsDetail.id) &&
        !addedInRequest.has(quizQuesAnsDetail.id)
      ) {
        userLog.userQuizLogs.add(
          new UserQuizLog({ quizQuesAnsDetail, userLog })
        );
        addedInRequest.add(quizQuesAnsDetail.id);
      }
    });

    if (addedInRequest.size > 0) {
      await this.em.flush();
    }

    await userLog.userQuizLogs.init();
    return userLog.userQuizLogs.getItems();
  }

  async getUserLogsWithQuizDetails(userId: string): Promise<UserLog | null> {
    return this.findOne(
      { userId },
      { populate: ['userQuizLogs', 'userQuizLogs.quizQuesAnsDetail'] }
    );
  }

  async addSearchLogToUserLog(userId: string, searchLog: string) {
    let userLog = await this.findOne({ userId });
    if (!userLog) {
      userLog = this.createUserLog(userId);
    }
    userLog.userSearchLogs.load();
    userLog.userSearchLogs.add(
      new UserSearchLog({ content: searchLog, userLog })
    );
    await this.em.flush();
    return userLog.userSearchLogs.getItems();
  }

  async getUserLogsWithSearchLogs(userId: string): Promise<UserLog | null> {
    return this.findOne({ userId }, { populate: ['userSearchLogs'] });
  }

  async saveUserLog(userLog: UserLog): Promise<void> {
    this.em.persist(userLog);
    await this.em.flush();
  }
}
