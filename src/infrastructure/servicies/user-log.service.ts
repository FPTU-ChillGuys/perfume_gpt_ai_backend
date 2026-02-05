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
import {
  AllUserLogRequest,
  UserLogRequest
} from 'src/application/dtos/request/user-log.request';
import { endOfDay, startOfDay } from 'date-fns';
import { convertToUTC } from '../utils/time-zone';
import { UserLogSummary } from 'src/domain/entities/user-log-summary';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { UserLogSummaryMapper } from 'src/application/mapping/custom/user-log-summary.mapper';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';

@Injectable()
export class UserLogService {
  constructor(private unitOfWork: UnitOfWork) {}

  async getUserLogsByUserId(userId: string): Promise<BaseResponse<UserLog | null>> {
    return await funcHandlerAsync(
      async () => {
        const userLog = await this.unitOfWork.UserLogRepo.findOne({ userId });
        if (!userLog) {
          return { success: false, error: 'User log not found', data: null };
        }
        return { success: true, data: userLog };
      },
      'Failed to get user log',
      true
    );
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

  async saveUserLogSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
    summary: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const userLogSummary = new UserLogSummary({
          userId,
          startDate,
          endDate,
          logSummary: summary
        });

        await this.unitOfWork.UserLogSummaryRepo.insert(userLogSummary);
        return { success: true, data: userLogSummary.logSummary };
      },
      'Failed to save user log summary',
      true
    );
  }

  async getUserLogSummariesByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<UserLogSummaryResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.find({
          userId: userId,
          startDate: startDate
            ? startOfDay(convertToUTC(startDate))
            : new Date(0),
          endDate: endDate
            ? endOfDay(convertToUTC(endDate))
            : endOfDay(new Date())
        });
        if (!userLogSummary) {
          return { success: false, error: 'User log summary not found' };
        }
        return {
          success: true,
          data: UserLogSummaryMapper.toResponseList(userLogSummary)
        };
      },
      'Failed to get user log summary',
      true
    );
  }

  // Tao report tu cac user log summary
  async getUserLogSummaryReportByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const userLogSummaries = await this.getUserLogSummariesByUserId(
          userId,
          startDate,
          endDate
        );
        if (!userLogSummaries.success || !userLogSummaries.data) {
          return { success: false, error: 'User log summaries not found' };
        }
        const report = userLogSummaries.data
          .map((summary) => summary.logSummary)
          .join('\n');
        return { success: true, data: report };
      },
      'Failed to get user log summary report',
      true
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async collectAndSummarizeUserLogs(
    userLogRequest: UserLogRequest
  ): Promise<BaseResponse<{ prompt: string; response: string }>> {
    return await funcHandlerAsync(
      async () => {
        if (!userLogRequest.startDate) {
          userLogRequest.startDate = this.getFirstDateOfPeriod(
            userLogRequest.period,
            convertToUTC(userLogRequest.endDate)
          );
        }

        // Lay log cua user trong khoang thoi gian
        const userLog = await this.unitOfWork.UserLogRepo.getUserLogByUserId(
          userLogRequest.userId
        );

        if (!userLog) {
          return { success: false, error: 'User log not found' };
        }

        // Lay log tim kiem cua user trong khoang thoi gian
        const searchLogs = userLog.userSearchLogs.getItems().filter((log) => {
          return (
            log.createdAt >=
              startOfDay(convertToUTC(userLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(userLogRequest.endDate))
          );
        });

        //Lay noi dung tim kiem
        const searchContents = searchLogs.map((log) => log.content).join('; ');

        //Lay log tin nhan cua user trong khoang thoi gian
        const messageLogs = userLog.userMessageLogs.getItems().filter((log) => {
          return (
            log.createdAt >=
              startOfDay(convertToUTC(userLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(userLogRequest.endDate))
          );
        });

        // Lay noi dung tin nhan
        const messageContents = messageLogs
          .map((log) => log.message?.message)
          .join('; ');

        // Lay log quiz cua user trong khoang thoi gian
        const quizLogs = await userLog.userQuizLogs.getItems().filter((log) => {
          return (
            log.createdAt >=
              startOfDay(convertToUTC(userLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(userLogRequest.endDate))
          );
        });

        // Lay noi dung quiz
        const quizContents = quizLogs
          .map((log) => log.quizQuesAnsDetail?.answer)
          .join('; ');

        // Tao prompt de tong hop log
        const prompt = this.generateSummaryPrompt(
          searchContents,
          messageContents,
          quizContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        const response = this.convertUserLogsToString(
          searchContents,
          messageContents,
          quizContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        return { success: true, data: { prompt, response } };
      },
      'Failed to summarize user logs',
      true
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async collectAndSummarizeAllUsersLogs(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<{ prompt: string; response: string }>> {
    return await funcHandlerAsync(async () => {
      if (!allUserLogRequest.startDate) {
        allUserLogRequest.startDate = this.getFirstDateOfPeriod(
          allUserLogRequest.period,
          allUserLogRequest.endDate
        );
      }

      // Lay log cua user trong khoang thoi gian
      const userLogs = await this.unitOfWork.UserLogRepo.getAllUserLogs();

      let prompt = '';
      let response = '';

      for (const userLog of userLogs) {
        // Lay log tim kiem cua user trong khoang thoi gian
        const searchLogs = userLog.userSearchLogs.getItems().filter((log) => {
          return (
            log.createdAt >=
              startOfDay(convertToUTC(allUserLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(allUserLogRequest.endDate))
          );
        });

        //Lay noi dung tim kiem
        const searchContents = searchLogs.map((log) => log.content).join('; ');

        //Lay log tin nhan cua user trong khoang thoi gian
        const messageLogs = userLog.userMessageLogs.getItems().filter((log) => {
          return (
            log.createdAt >=
              startOfDay(convertToUTC(allUserLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(allUserLogRequest.endDate))
          );
        });

        // Lay noi dung tin nhan
        const messageContents = messageLogs
          .map((log) => log.message?.message)
          .join('; ');

        // Lay log quiz cua user trong khoang thoi gian
        const quizLogs = await userLog.userQuizLogs.getItems().filter((log) => {
          return (
            log.createdAt >=
              startOfDay(convertToUTC(allUserLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(allUserLogRequest.endDate))
          );
        });

        // Lay noi dung quiz
        const quizContents = quizLogs
          .map((log) => log.quizQuesAnsDetail?.answer)
          .join('; ');

        // Tao prompt de tong hop log
        prompt +=
          this.generateSummaryPrompt(
            searchContents,
            messageContents,
            quizContents,
            startOfDay(convertToUTC(allUserLogRequest.startDate!)),
            endOfDay(convertToUTC(allUserLogRequest.endDate))
          ) + '\n';

        response =
          this.convertUserLogsToString(
            searchContents,
            messageContents,
            quizContents,
            startOfDay(convertToUTC(allUserLogRequest.startDate!)),
            endOfDay(convertToUTC(allUserLogRequest.endDate))
          ) + '\n';
      }

      return { success: true, data: { prompt, response } };
    }, 'Failed to summarize user logs');
  }

  getFirstDateOfPeriod(period: PeriodEnum, endDate: Date): Date {
    const endDateObj = new Date(endDate);
    let startDate = new Date(endDateObj);
    if (period === PeriodEnum.WEEKLY) {
      startDate = new Date(endDateObj);
      startDate.setDate(endDateObj.getDate() - 7);
    } else if (period === PeriodEnum.MONTHLY) {
      startDate = new Date(endDateObj);
      startDate.setMonth(endDateObj.getMonth() - 1);
    } else if (period === PeriodEnum.YEARLY) {
      startDate = new Date(endDateObj);
      startDate.setFullYear(endDateObj.getFullYear() - 1);
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
    let prompt = `Summarize the user's activities from ${startDate.toDateString()} to ${new Date(endDate).toDateString()}.\n`;
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

  convertUserLogsToString(
    searchContents: string,
    messageContents: string,
    quizContents: string,
    startDate: Date,
    endDate: Date
  ): string {
    const response = `User activity summary from ${startOfDay(new Date(startDate))} to ${endOfDay(new Date(endDate))}:\n
    Search Activities: ${searchContents}\n
    Messages: ${messageContents}\n
    Quiz Answers: ${quizContents}\n`;
    return response;
  }
}
