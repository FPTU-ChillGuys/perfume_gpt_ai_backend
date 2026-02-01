import { UnitOfWork } from '../repositories/unit-of-work';
import { Injectable } from '@nestjs/common';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from '../utils/error-handler';
import { UserLog } from 'src/domain/entities/user-log.entity';
import { UserSearchLogMapper } from 'src/application/mapping';
import { UserSearchLog } from 'src/domain/entities/user-search.log.entity';
import { UserSearchLogResponse } from 'src/application/dtos/response/user-search-log.response';
import { PeriodEnum } from 'src/domain/enum/period.enum';

@Injectable()
export class UserLogService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async getUserLogByUserId(userId: string): Promise<UserLog | null> {
    return this.unitOfWork.UserLogRepo.findOne({ userId });
  }

  async createUserLogIfNotExist(userId: string): Promise<UserLog> {
    let existingLog = await this.unitOfWork.UserLogRepo.findOne({ userId });
    if (!existingLog) {
      existingLog = await this.unitOfWork.UserLogRepo.createUserLog(userId);
    }
    return existingLog;
  }

  async addUserSearch(
    searchText: string,
    userId: string
  ): Promise<BaseResponse<UserSearchLogResponse[]>> {
    return await funcHandlerAsync(async () => {
      const searchLog = await this.unitOfWork.UserLogRepo.addSearchLogToUserLog(
        userId,
        searchText
      );
      const searchLogResponse = UserSearchLogMapper.toResponseList(searchLog);
      return { success: true, data: searchLogResponse };
    }, 'Failed to add user search log');
  }

  async addSearchLogToUserLog(
    userId: string,
    searchText: string
  ): Promise<UserSearchLog[]> {
    // Response existing user log or create new one
    const user = await this.createUserLogIfNotExist(userId);

    return this.unitOfWork.UserLogRepo.addSearchLogToUserLog(
      user.id,
      searchText
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async summarizeUserLogs(
    userId: string,
    period: PeriodEnum,
    endDate: Date,
    startDate?: Date
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      if (!startDate) {
        startDate = this.getFirstDateOfPeriod(period, endDate);
      }

      // Lay log cua user trong khoang thoi gian
      const userLog = await this.unitOfWork.UserLogRepo.getUserLogsWithMessages(
        userId
      );

      if (!userLog) {
        return { success: false, error: 'User log not found' };
      }

      // Lay log tim kiem cua user trong khoang thoi gian
      const searchLogs = userLog.userSearchLogs.getItems().filter((log) => {
        return log.createdAt >= startDate! && log.createdAt <= endDate;
      });

      //Lay noi dung tim kiem
      const searchContents = searchLogs.map((log) => log.content).join('; ');

      //Lay log tin nhan cua user trong khoang thoi gian
      const messageLogs = userLog.userMessageLogs.getItems().filter((log) => {
        return log.createdAt >= startDate! && log.createdAt <= endDate;
      });

      // Lay noi dung tin nhan
      const messageContents = messageLogs
        .map((log) => log.message.message)
        .join('; ');

      // Lay log quiz cua user trong khoang thoi gian
      const quizLogs = await userLog.userQuizLogs.getItems().filter((log) => {
        return log.createdAt >= startDate! && log.createdAt <= endDate;
      });

      // Lay noi dung quiz
      const quizContents = quizLogs
        .map((log) => log.quizQuesAnsDetail.answer)
        .join('; ');

      // Tao prompt de tong hop log
      const prompt = this.generateSummaryPrompt(
        searchContents,
        messageContents,
        quizContents,
        startDate!,
        endDate
      );

      return { success: true, data: prompt };
    }, 'Failed to summarize user logs');
  }

  getFirstDateOfPeriod(period: PeriodEnum, endDate: Date): Date {
    let startDate = new Date(endDate);
    if (period === PeriodEnum.WEEKLY) {
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 7);
    } else if (period === PeriodEnum.MONTHLY) {
      startDate = new Date(endDate);
      startDate.setMonth(endDate.getMonth() - 1);
    } else if (period === PeriodEnum.YEARLY) {
      startDate = new Date(endDate);
      startDate.setFullYear(endDate.getFullYear() - 1);
    } else {
      throw new Error('Invalid period enum');
    }
    return startDate;
  }

  //Tao prompt de tong hop log
  generateSummaryPrompt(
    searchContents: string,
    messageContents: string,
    quizContents: string,
    startDate: Date,
    endDate: Date
  ): string {
    let prompt = `Summarize the user's activities from ${startDate.toDateString()} to ${endDate.toDateString()}.\n`;  
    if (searchContents) {
      prompt += `Search activities: ${searchContents}\n`;
    }
    if (messageContents) {
      prompt += `Messages: ${messageContents}\n`;
    }
    if (quizContents) {
      prompt += `Quiz answers: ${quizContents}\n`;
    }
    prompt += `Provide a concise summary of the user's activities during this period.`;
    return prompt;
  }
}
