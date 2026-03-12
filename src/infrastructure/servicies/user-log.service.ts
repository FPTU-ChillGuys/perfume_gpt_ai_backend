import { UnitOfWork } from '../repositories/unit-of-work';
import { Inject, Injectable } from '@nestjs/common';
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
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns';
import { convertToUTC } from '../utils/time-zone';
import { UserLogSummary } from 'src/domain/entities/user-log-summary';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { UserLogSummaryMapper } from 'src/application/mapping/custom/user-log-summary.mapper';
import { generateSummaryPrompt, INSTRUCTION_TYPE_LOG } from 'src/application/constant/prompts';
import { UserQuizLog } from 'src/domain/entities/user-quiz-log.entity';
import { AIHelper } from '../helpers/ai.helper';
import { AI_HELPER } from '../modules/ai.module';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { INSUFFICIENT_DATA_MESSAGES, isDataEmpty } from '../utils/insufficient-data';
import { AdminInstructionService } from './admin-instruction.service';

@Injectable()
export class UserLogService {
  constructor(
    protected unitOfWork: UnitOfWork,
    protected adminInstructionService: AdminInstructionService,
    @Inject(AI_HELPER) private readonly aiHelper: AIHelper
  ) {}

  /** Lay tat ca log */
  async getAllLogs(): Promise<BaseResponse<UserLog[]>> {
    return await funcHandlerAsync(
      async () => {
        const userLogs = await this.unitOfWork.UserLogRepo.getAllUserLogs();
        return { success: true, data: userLogs };
      },
      'Failed to get all user logs',
      true
    );
  }

  /** Lay tat ca log */
  async getUserLogsWithPeriod(allUserLogRequest: AllUserLogRequest): Promise<BaseResponse<UserLog[]>> {
    return await funcHandlerAsync(
      async () => {

        if (!allUserLogRequest.startDate) {
          allUserLogRequest.startDate = this.getFirstDateOfPeriod(
            allUserLogRequest.period,
            convertToUTC(allUserLogRequest.endDate)
          );
        }

        const request = new AllUserLogRequest({
          startDate: convertToUTC(startOfDay(allUserLogRequest.startDate)),
          endDate: convertToUTC(endOfDay(allUserLogRequest.endDate)),
          period: allUserLogRequest.period,
        });

        const userLogs = await this.unitOfWork.UserLogRepo.getUserLogsWithPeriod(request);
        return { success: true, data: userLogs };
      },
      'Failed to get all user logs',
      true
    );
  }



  /** Lay log tu userId */
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

  async updateUserLogSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
    summary: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const existingSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({
          userId,
          startDate,
          endDate
        });
        if (!existingSummary) {
          return { success: false, error: 'User log summary not found' };
        }
        existingSummary.logSummary = summary;
        this.unitOfWork.UserLogSummaryRepo.upsert(existingSummary);
        return { success: true, data: existingSummary.logSummary };

      },
      'Failed to update user log summary',
      true
    );
  }

  /** Lay summary tu userId */
  async getUserLogSummariesByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<UserLogSummaryResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        console.log(
          `Start Date: ${startDate ? startOfDay(convertToUTC(startDate)) : new Date(0)
          }, End Date: ${endDate ? endOfDay(convertToUTC(endDate)) : endOfDay(new Date())
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
        const report = `User Log Summary Report from ${startDate ? convertToUTC(startDate) : 'the beginning'} to ${endDate ? convertToUTC(endDate) : new Date().toISOString()
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
        const searchLogs = userLog.userSearchLogs?.getItems().filter((log) => {
          return (
            log.createdAt >=
            startOfDay(convertToUTC(userLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(userLogRequest.endDate))
          );
        });

        //Lay noi dung tim kiem
        const searchContents =
          'Search: ' + searchLogs.map((log) => log.content).join(';\n');

        //Lay log tin nhan cua user trong khoang thoi gian
        const messageLogs = userLog.userMessageLogs?.getItems().filter((log) => {
          return (
            log.createdAt >=
            startOfDay(convertToUTC(userLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(userLogRequest.endDate))
          );
        });

        // Lay noi dung tin nhan
        const messageContents =
          'Messages: ' +
          messageLogs.map((log) => log.message?.message).join(';\n');

        // Lay log quiz cua user trong khoang thoi gian
        const quizLogs = await userLog.userQuizLogs?.getItems().filter((log) => {
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

      console.log(`Period: ${allUserLogRequest.period}`);
      console.log(`Start Date: ${allUserLogRequest.startDate}`);
      console.log(`End Date: ${allUserLogRequest.endDate}`);

      // Lay log cua user trong khoang thoi gian
      const userLogs = await this.unitOfWork.UserLogRepo.getAllUserLogs();

      let prompt = '';
      let response = '';

      for (const userLog of userLogs) {
        // Lay log tim kiem cua user trong khoang thoi gian
        const searchLogs = userLog.userSearchLogs?.getItems().filter((log) => {
          return (
            log.createdAt >=
            startOfDay(convertToUTC(allUserLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(allUserLogRequest.endDate))
          );
        });

        //Lay noi dung tim kiem
        const searchContents =
          'Search: ' + searchLogs.map((log) => log.content).join(';\n');

        //Lay log tin nhan cua user trong khoang thoi gian
        const messageLogs = userLog.userMessageLogs?.getItems().filter((log) => {
          return (
            log.createdAt >=
            startOfDay(convertToUTC(allUserLogRequest.startDate!)) &&
            log.createdAt <= endOfDay(convertToUTC(allUserLogRequest.endDate))
          );
        });

        // Lay noi dung tin nhan
        const messageContents =
          'Messages: ' +
          messageLogs.map((log) => log.message?.message).join(';\n');

        // Lay log quiz cua user trong khoang thoi gian
        const quizLogs = await userLog.userQuizLogs?.getItems().filter((log) => {
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

        response +=
          this.convertUserLogsToReport(
            searchContents,
            messageContents,
            quizContents,
            startOfDay(convertToUTC(allUserLogRequest.startDate!)),
            endOfDay(convertToUTC(allUserLogRequest.endDate))
          ) + '\n';
      }

      return { success: true, data: { prompt, response } };
    }, 'Failed to summarize user logs', true);
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

  /** Lay log tu userId */
  async getUserLogs(userId: string, endDate?: Date, startDate?: Date): Promise<BaseResponse<UserLog | null>> {
    return funcHandlerAsync(
      async () => {
        const userLog = await this.unitOfWork.UserLogRepo.findOne(
          {
            userId,
            updatedAt: {
              $gte: startDate || startOfWeek(convertToUTC(new Date())),
              $lte: endDate || endOfWeek(convertToUTC(new Date()))
            }
          },
          { populate: ['userSearchLogs', 'userMessageLogs', 'userQuizLogs'] }
        );
        if (!userLog) {
          return { success: false, error: 'User log not found', data: null };
        }
        return { success: true, data: userLog };
      },
      'Failed to get user logs',
      true
    );
  }

  /** Lay log tu userId theo tuan */
  async getUserLogsByWeek(userId: string): Promise<BaseResponse<UserLog | null>> {
    const endDate = endOfWeek(convertToUTC(new Date()));
    const startDate = startOfWeek(convertToUTC(new Date()));
    return this.getUserLogs(userId, endDate, startDate);
  }

  /** Lay log tu userId theo thang */
  async getUserLogsByMonth(userId: string): Promise<BaseResponse<UserLog | null>> {
    const endDate = endOfMonth(convertToUTC(new Date()));
    const startDate = startOfMonth(convertToUTC(new Date(endDate)));
    return this.getUserLogs(userId, endDate, startDate);
  }

  /** Lay log tu userId theo nam */
  async getUserLogsByYear(userId: string): Promise<BaseResponse<UserLog | null>> {
    const endDate = endOfYear(convertToUTC(new Date()));
    const startDate = startOfYear(convertToUTC(new Date(endDate)));
    return this.getUserLogs(userId, endDate, startDate);
  }

  /** Lay user log summary tu userId */
  async getUserLogSummaryByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<BaseResponse<UserLogSummary | null>> {
    return funcHandlerAsync(
      async () => {
        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({
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
          return { success: false, error: 'User log summary not found', data: null };
        }
        return { success: true, data: userLogSummary };
      },
      'Failed to get user log summary',
      true
    );
  }

  async getAllUserLogSummary(allUserLogRequest: AllUserLogRequest): Promise<BaseResponse<UserLogSummary[] | null>> {
    return funcHandlerAsync(
      async () => {
        const startDate = allUserLogRequest.startDate ?? this.getFirstDateOfPeriod(allUserLogRequest.period, allUserLogRequest.endDate);

        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.find({
          startDate: {
            $gte: startDate
          },
          endDate: {
            $lte: endOfDay(convertToUTC(allUserLogRequest.endDate))
          }
        });

        if (!userLogSummary) {
          return { success: false, error: 'User log summary not found', data: null };
        }
        return { success: true, data: userLogSummary };
      },
      'Failed to get user log summary',
      true
    );
  }

  async getAllUserLogSummaryReport(allUserLogRequest: AllUserLogRequest): Promise<BaseResponse<string | null>> {
    return funcHandlerAsync(
      async () => {
        const summaries = await this.getAllUserLogSummary(allUserLogRequest);
        if (!summaries.success) {
          return { success: false, error: 'User log summary not found', data: null };
        }

        const report = summaries.data?.map(summary => summary.logSummary).join('\n');
        return { success: true, data: report };
      },
      'Failed to get user log summary report',
      true
    );
  }


  /** Lay user summary theo tuan */
  async getUserLogSummaryByWeek(userId: string): Promise<BaseResponse<UserLogSummary | null>> {
    const currentDate = new Date();
    const endDate = endOfWeek(convertToUTC(currentDate));
    const startDate = startOfWeek(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(userId, startDate, endDate);
  }

  /** Lay user summary theo thang */
  async getUserLogSummaryByMonth(userId: string): Promise<BaseResponse<UserLogSummary | null>> {
    const currentDate = new Date();
    const endDate = endOfMonth(convertToUTC(currentDate));
    const startDate = startOfMonth(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(userId, startDate, endDate);
  }

  /** Lay user summary theo nam */
  async getUserLogSummaryByYear(userId: string): Promise<BaseResponse<UserLogSummary | null>> {
    const currentDate = new Date();
    const endDate = endOfYear(convertToUTC(currentDate));
    const startDate = startOfYear(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(userId, startDate, endDate);
  }

  /** Tong hop log va goi AI, tra ve chuoi ket qua (dung cho controller) */
  async summarizeUserLogs(request: UserLogRequest): Promise<BaseResponse<string>> {
    const reportResult = await this.getReportAndPromptSummaryUserLogs(request);
    if (!reportResult.success || !reportResult.data) {
      return { success: false, error: 'Failed to get user log report' };
    }
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_LOG);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(reportResult.data.prompt, systemPrompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return Ok(aiResponse.data);
  }

  /** Tong hop log tat ca user va goi AI, tra ve chuoi ket qua (dung cho controller) */
  async summarizeAllUserLogs(request: AllUserLogRequest): Promise<BaseResponse<string>> {
    const reportResult = await this.getReportAndPromptSummaryAllUsersLogs(request);
    if (!reportResult.success || !reportResult.data) {
      return { success: false, error: 'Failed to get all user log report' };
    }
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_LOG);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(reportResult.data.prompt, systemPrompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return Ok(aiResponse.data);
  }

  /** Tong hop log, goi AI, luu ket qua vao DB (dung cho scheduler) */
  async summarizeAndSaveForUser(userId: string, period: PeriodEnum): Promise<void> {
    const userLogRequest = new UserLogRequest({ userId, period, endDate: new Date() });
    const reportResult = await this.getReportAndPromptSummaryUserLogs(userLogRequest);
    if (!reportResult.success || !reportResult.data) {
      console.log(`Failed to summarize logs for userId: ${userId}`);
      return;
    }
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_LOG);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(reportResult.data.prompt, systemPrompt);
    const startDate = convertToUTC(userLogRequest.startDate) ||
      this.getFirstDateOfPeriod(userLogRequest.period!, userLogRequest.endDate!);
    await this.saveUserLogSummary(userId, startDate, userLogRequest.endDate!, aiResponse.data || '');
    if (!aiResponse.success) {
      console.log(`Failed to get AI response for userId: ${userId}`);
    } else {
      console.log(`Successfully summarized logs for userId: ${userId}`);
    }
  }

  /** Tong hop log tat ca user, goi AI, luu ket qua vao DB (dung cho scheduler) */
  async summarizeAndSaveForAllUsers(period: PeriodEnum): Promise<void> {
    const userIds = await this.getAllUserIdsFromLogs();
    console.log(`Found ${userIds.length} unique user IDs.`);
    for (const userId of userIds) {
      await this.summarizeAndSaveForUser(userId, period);
    }
    console.log('Scheduled task completed: User logs summarized and saved.');
  }

  async summarizePerWeek(): Promise<void> {
    try {
      await this.summarizeAndSaveForAllUsers(PeriodEnum.WEEKLY);
    } catch (error) {
      console.error('Error summarizing weekly logs:', error);
    }
  }

  async summarizePerMonth(): Promise<void> {
    try {
      await this.summarizeAndSaveForAllUsers(PeriodEnum.MONTHLY);
    } catch (error) {
      console.error('Error summarizing monthly logs:', error);
    }
  }

  async summarizePerYear(): Promise<void> {
    try {
      await this.summarizeAndSaveForAllUsers(PeriodEnum.YEARLY);
    } catch (error) {
      console.error('Error summarizing yearly logs:', error);
    }
  }
}

