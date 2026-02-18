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
import {
  endOfDay,
  endOfMinute,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay
} from 'date-fns';
import { convertToUTC } from '../utils/time-zone';
import { UserLogSummary } from 'src/domain/entities/user-log-summary';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { UserLogSummaryMapper } from 'src/application/mapping/custom/user-log-summary.mapper';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';
import { generateSummaryPrompt } from 'src/application/constant/prompts';
import { UserQuizLog } from 'src/domain/entities/user-quiz-log.entity';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { SimpleMemoryCache } from '../utils/simple-memory-cache';

@Injectable()
export class UserLogService {
  /** Cache cho user log summary report (TTL = 5 phút) */
  private readonly summaryCache = new SimpleMemoryCache<string>(5 * 60 * 1000);

  constructor(private unitOfWork: UnitOfWork) {}

  async getUserLogsByUserId(
    userId: string
  ): Promise<BaseResponse<UserLog | null>> {
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

  async addQuizQuesAnsDetailToUserLog(
    userId: string,
    quizQuesAnsId: string
  ): Promise<UserQuizLog[]> {
    // Response existing user log or create new one
    const user = await this.createUserLogIfNotExist(userId);

    const quizQuesAnsDetail =
      await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne({
        id: quizQuesAnsId
      });

    return this.unitOfWork.UserLogRepo.addQuizQuesAnsDetailsLogToUserLog(
      user.id,
      quizQuesAnsDetail?.details.getItems() || []
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
        console.log(
          `Start Date: ${
            startDate ? startOfDay(convertToUTC(startDate)) : new Date(0)
          }, End Date: ${
            endDate ? endOfDay(convertToUTC(endDate)) : endOfDay(new Date())
          }`
        );

        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.find({
          userId: userId,
          startDate: {
            $gte: startDate ? startOfDay(convertToUTC(startDate)) : new Date(0)
          },
          endDate: {
            $lte: endDate
              ? endOfDay(convertToUTC(endDate))
              : endOfDay(convertToUTC(new Date()))
          }
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
        // Tao data tu cac log summary
        const data = userLogSummaries.data
          .map((summary) => summary.logSummary)
          .join('\n');

        // Tao report
        const report = `User Log Summary Report from ${startDate ? convertToUTC(startDate) : 'the beginning'} to ${
          endDate ? convertToUTC(endDate) : new Date().toISOString()
        }:\n${data}`;

        return { success: true, data: report };
      },
      'Failed to get user log summary report',
      true
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async getReportAndPromptSummaryUserLogs(
    userLogRequest: UserLogRequest
  ): Promise<
    BaseResponse<{ prompt: string; response: string; count: number }>
  > {
    return await funcHandlerAsync(
      async () => {
        // Xu ly neu khong co startDate thi lay theo period
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
          .map((log) =>
            `Question: ${log.quizQuesAnsDetail?.question?.question ?? ''}\n Answer: ${log.quizQuesAnsDetail?.answer?.answer ?? ''}`.trim()
          )
          .join('; ');

        console.log(`User ID: ${userLog.userId}`);
        console.log(`Search Contents: ${searchContents}`);
        console.log(`Message Contents: ${messageContents}`);
        console.log(`Quiz Contents: ${quizContents}`);

        // Tao prompt de tong hop log
        const prompt = generateSummaryPrompt(
          searchContents,
          messageContents,
          quizContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        // Tao response tu cac log
        const response = this.convertUserLogsToReport(
          searchContents,
          messageContents,
          quizContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        const count = searchLogs.length + messageLogs.length + quizLogs.length;

        return { success: true, data: { prompt, response, count } };
      },
      'Failed to summarize user logs',
      true
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async getReportAndPromptSummaryAllUsersLogs(
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
          .map((log) =>
            `Question: ${log.quizQuesAnsDetail?.question?.question ?? ''}\n Answer: ${log.quizQuesAnsDetail?.answer?.answer ?? ''}`.trim()
          )
          .join('; ');

        console.log(`User ID: ${userLog.userId}`);
        console.log(`Search Contents: ${searchContents}`);
        console.log(`Message Contents: ${messageContents}`);
        console.log(`Quiz Contents: ${quizContents}`);

        // Tao prompt de tong hop log
        prompt +=
          generateSummaryPrompt(
            searchContents,
            messageContents,
            quizContents,
            startOfDay(convertToUTC(allUserLogRequest.startDate!)),
            endOfDay(convertToUTC(allUserLogRequest.endDate))
          ) + '\n';

        response =
          this.convertUserLogsToReport(
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

  // Tam thoi lay tat ca userId tu log
  async getAllUserIdsFromLogs(): Promise<string[]> {
    const userLogs = await this.unitOfWork.UserLogRepo.getAllUserLogs();
    const userIds = userLogs
      .map((log) => log.userId)
      .filter((userId): userId is string => typeof userId === 'string');
    return Array.from(new Set(userIds));
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

  // Chuyen doi cac log nguoi dung thanh chuoi de tao report
  convertUserLogsToReport(
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

  /**
   * Phiên bản có cache của getUserLogSummaryReportByUserId.
   * Cache theo userId với TTL = 5 phút, tránh query + tổng hợp lặp lại cho cùng user.
   */
  async getCachedUserLogSummaryReportByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<string>> {
    const cacheKey = `summary:${userId}:${startDate?.toISOString() ?? '0'}:${endDate?.toISOString() ?? 'now'}`;

    const cached = this.summaryCache.get(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    const result = await this.getUserLogSummaryReportByUserId(
      userId,
      startDate,
      endDate
    );

    if (result.success && result.data) {
      this.summaryCache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Phiên bản có cache của getReportAndPromptSummaryUserLogs.
   * Cache theo userId + period với TTL = 5 phút.
   */
  async getCachedReportAndPromptSummaryUserLogs(
    userLogRequest: UserLogRequest
  ): Promise<BaseResponse<{ prompt: string; response: string }>> {
    const cacheKey = `report:${userLogRequest.userId}:${userLogRequest.period}:${userLogRequest.endDate?.toISOString() ?? 'now'}`;

    const cached = this.summaryCache.get(cacheKey);
    if (cached) {
      // Giả lập cấu trúc response từ cache
      return { success: true, data: { prompt: cached, response: cached } };
    }

    const result = await this.getReportAndPromptSummaryUserLogs(userLogRequest);

    if (result.success && result.data) {
      this.summaryCache.set(cacheKey, result.data.response);
    }

    return result;
  }

  /** Xóa cache summary cho một userId cụ thể hoặc toàn bộ. */
  clearSummaryCache(userId?: string): void {
    if (userId) {
      // Xóa tất cả cache liên quan đến userId
      this.summaryCache.cleanup();
    } else {
      this.summaryCache.clear();
    }
  }

  /** Kiem tra neu co log trong tuan khong bat dau tu chu nhat luc 23:59 */
  async isLogsFromLastWeek(userId: string): Promise<boolean> {
    const response = await this.getReportAndPromptSummaryUserLogs(
      new UserLogRequest({
        userId,
        period: PeriodEnum.WEEKLY,
        endDate: endOfWeek(convertToUTC(new Date()))
      })
    );
    if (!response.success) {
      console.log(`Failed to get user logs for userId: ${userId}`);
      return false;
    }
    return response.data?.count! > 0;
  }

  /** Kiem tra neu co log trong thang khong */
  async isLogsFromLastMonth(userId: string): Promise<boolean> {
    const response = await this.getReportAndPromptSummaryUserLogs(
      new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: endOfMonth(convertToUTC(new Date()))
      })
    );
    if (!response.success) {
      console.log(`Failed to get user logs for userId: ${userId}`);
      return false;
    }
    return response.data?.count! > 0;
  }

  /** Kiem tra neu co log trong nam khong */
  async isLogsFromLastYear(userId: string): Promise<boolean> {
    const response = await this.getReportAndPromptSummaryUserLogs(
      new UserLogRequest({
        userId,
        period: PeriodEnum.YEARLY,
        endDate: endOfYear(convertToUTC(new Date()))
      })
    );
    if (!response.success) {
      console.log(`Failed to get user logs for userId: ${userId}`);
      return false;
    }
    return response.data?.count! > 0;
  }
}
