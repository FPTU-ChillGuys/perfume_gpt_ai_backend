import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import * as z from 'zod';

@Injectable()
export class LogTool {
  private readonly logger = new Logger(LogTool.name);

  constructor(private readonly userLogService: UserLogService) {}

  /**
   * Lấy báo cáo hoạt động của một user trong khoảng thời gian.
   * AI dùng tool này để hiểu user đã làm gì gần đây (search, chat, survey).
   */
  getUserActivityReportPerWeek: Tool = tool({
    description:
      'Get a text activity report for a specific user within a week. ' +
      'Returns a summary of their searches, messages, and survey answers. ' +
      'Use this to personalize recommendations or understand user behavior.' +
      'Tốt nhất là dùng cho phần tích trend.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      endDate: z
        .string()
        .describe('End date in ISO format, e.g. "2025-12-31T23:59:59Z"')
    }),
    execute: async (input) => {
      this.logger.log(`[getUserActivityReportPerWeek] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response =
            await this.userLogService.getReportAndPromptSummaryUserLogs({
              userId: input.userId,
              period: PeriodEnum.WEEKLY,
              endDate: new Date(input.endDate)
            });
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch user activity report.'
            };
          }
          return { success: true, data: response.data?.response || '' };
        },
        'Error occurred while fetching user activity report.',
        true
      );
    }
  });

  /**
   * Lấy báo cáo hoạt động của một user trong khoảng thời gian.
   * AI dùng tool này để hiểu user đã làm gì gần đây (search, chat, survey).
   */
  getUserActivityReportPerMonth: Tool = tool({
    description:
      'Get a text activity report for a specific user within a month. ' +
      'Returns a summary of their searches, messages, and survey answers. ' +
      'Use this to personalize recommendations or understand user behavior.' +
      'Tốt nhất là dùng cho phần tích trend.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      endDate: z
        .string()
        .describe('End date in ISO format, e.g. "2025-12-31T23:59:59Z"')
    }),
    execute: async (input) => {
      this.logger.log(`[getUserActivityReportPerMonth] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response =
            await this.userLogService.getReportAndPromptSummaryUserLogs({
              userId: input.userId,
              period: PeriodEnum.MONTHLY,
              endDate: new Date(input.endDate)
            });
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch user activity report.'
            };
          }
          return { success: true, data: response.data?.response || '' };
        },
        'Error occurred while fetching user activity report.',
        true
      );
    }
  });

  /**
   * Lấy báo cáo hoạt động của một user trong khoảng thời gian.
   * AI dùng tool này để hiểu user đã làm gì gần đây (search, chat, survey).
   */
  getUserActivityReportPerYear: Tool = tool({
    description:
      'Get a text activity report for a specific user within a year. ' +
      'Returns a summary of their searches, messages, and survey answers. ' +
      'Use this to personalize recommendations or understand user behavior.' +
      'Nên dùng cho trend và phân tích.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      endDate: z
        .string()
        .describe('End date in ISO format, e.g. "2025-12-31T23:59:59Z"')
    }),
    execute: async (input) => {
      this.logger.log(`[getUserActivityReportPerYear] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response =
            await this.userLogService.getReportAndPromptSummaryUserLogs({
              userId: input.userId,
              period: PeriodEnum.YEARLY,
              endDate: new Date(input.endDate)
            });
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch user activity report.'
            };
          }
          return { success: true, data: response.data?.response || '' };
        },
        'Error occurred while fetching user activity report.',
        true
      );
    }
  });

  /**
   * Lấy bản tóm tắt hành vi của user (rolling summary, không theo kỳ).
   * Dùng cho chatbot và recommendation.
   */
  getUserLogSummaryReport: Tool = tool({
    description:
      'Get the rolling behavior summary report of a user. ' +
      'Returns a pre-built text summary of their keywords, intents, active hours, and event types. ' +
      'Use this for personalized recommendations and chatbot context.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response =
            await this.userLogService.getUserLogSummaryReportByUserId(
              input.userId
            );
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch user log summary report.'
            };
          }
          return { success: true, data: response.data || '' };
        },
        'Error occurred while fetching user log summary report.',
        true
      );
    }
  });

  /**
   * Lấy bản tóm tắt tổng hợp hành vi của nhiều user (runtime only, không lưu DB).
   */
  getUserLogSummary: Tool = tool({
    description:
      'Get aggregated rolling log summary across multiple users. ' +
      'Returns total events, created time, overall summary text, overall feature snapshot, ' +
      'plus daily summary text and daily feature snapshots keyed by date. ' +
      'Use the daily fields for weekly or monthly trend analysis and the overall fields for broad context.',
    inputSchema: z.object({}),
    execute: async () => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.userLogService.getUserLogSummary();
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch aggregated user log summary.'
            };
          }
          return { success: true, data: response.data };
        },
        'Error occurred while fetching aggregated user log summary.',
        true
      );
    }
  });

  getUserLogSummaryByUserId: Tool = tool({
    description:
      'Get the rolling behavior summary report of a user. ' +
      'Returns a pre-built text summary of their keywords, intents, active hours, and event types. ' +
      'Use this for personalized recommendations and chatbot context.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.userLogService.getUserLogSummaryByUserId(
            input.userId
          );
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch aggregated user log summary.'
            };
          }
          return { success: true, data: response.data };
        },
        'Error occurred while fetching aggregated user log summary.',
        true
      );
    }
  });

  getUserLogSummaryByWeek: Tool = tool({
    description:
      'Get aggregated rolling log summary across multiple users for the past week. ' +
      'Returns total events, created time, overall summary text, overall feature snapshot, ' +
      'plus daily summary text and daily feature snapshots keyed by date. ' +
      'Use the daily fields for weekly trend analysis and the overall fields for broad context.',
    inputSchema: z.object({}),
    execute: async () => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.userLogService.getAllSummaryByPeriod(
            PeriodEnum.WEEKLY
          );
          if (!response.success) {
            return {
              success: false,
              error: 'Failed to fetch aggregated user log summary.'
            };
          }
          return { success: true, data: response.data };
        },
        'Error occurred while fetching aggregated user log summary.',
        true
      );
    }
  });
}
