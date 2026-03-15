import { Injectable } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import * as z from 'zod';

@Injectable()
export class LogTool {
    constructor(private readonly userLogService: UserLogService) { }




    /**
     * Lấy báo cáo hoạt động của một user trong khoảng thời gian.
     * AI dùng tool này để hiểu user đã làm gì gần đây (search, chat, quiz).
     */
    getUserActivityReportPerWeek: Tool = tool({
        description:
            'Get a text activity report for a specific user within a week. ' +
            'Returns a summary of their searches, messages, and quiz answers. ' +
            'Use this to personalize recommendations or understand user behavior.' +
            'Tốt nhất là dùng cho phần tích trend.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
            endDate: z
                .string()
                .describe('End date in ISO format, e.g. "2025-12-31T23:59:59Z"')
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getReportAndPromptSummaryUserLogs({
                            userId: input.userId,
                            period: PeriodEnum.WEEKLY,
                            endDate: new Date(input.endDate)
                        });
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user activity report.' };
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
     * AI dùng tool này để hiểu user đã làm gì gần đây (search, chat, quiz).
     */
    getUserActivityReportPerMonth: Tool = tool({
        description:
            'Get a text activity report for a specific user within a month. ' +
            'Returns a summary of their searches, messages, and quiz answers. ' +
            'Use this to personalize recommendations or understand user behavior.' +
            'Tốt nhất là dùng cho phần tích trend.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
            endDate: z
                .string()
                .describe('End date in ISO format, e.g. "2025-12-31T23:59:59Z"')
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getReportAndPromptSummaryUserLogs({
                            userId: input.userId,
                            period: PeriodEnum.MONTHLY,
                            endDate: new Date(input.endDate)
                        });
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user activity report.' };
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
     * AI dùng tool này để hiểu user đã làm gì gần đây (search, chat, quiz).
     */
    getUserActivityReportPerYear: Tool = tool({
        description:
            'Get a text activity report for a specific user within a year. ' +
            'Returns a summary of their searches, messages, and quiz answers. ' +
            'Use this to personalize recommendations or understand user behavior.' +
            'Nên dùng cho trend và phân tích.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
            endDate: z
                .string()
                .describe('End date in ISO format, e.g. "2025-12-31T23:59:59Z"')
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getReportAndPromptSummaryUserLogs({
                            userId: input.userId,
                            period: PeriodEnum.YEARLY,
                            endDate: new Date(input.endDate)
                        });
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user activity report.' };
                    }
                    return { success: true, data: response.data?.response || '' };
                },
                'Error occurred while fetching user activity report.',
                true
            );
        }
    });

    // /**
    //  * Lấy bản tóm tắt log đã được AI tóm tắt sẵn (summary table) của user.
    //  * Nhanh hơn getUserActivityReport vì đọc từ cache/DB summary.
    //  */
    // getUserLogSummaryReport: Tool = tool({
    //     description:
    //         'Get a pre-generated AI summary report of a user\'s activity logs. ' +
    //         'Faster than getUserActivityReport as it reads from saved summaries. ' +
    //         'Use this when you need a quick overview of what the user has been doing.',
    //     inputSchema: z.object({
    //         userId: z.string().describe('The ID of the user'),
    //         startDate: z
    //             .string()
    //             .optional()
    //             .describe('Start date in ISO format (optional)'),
    //         endDate: z
    //             .string()
    //             .optional()
    //             .describe('End date in ISO format (optional)')
    //     }),
    //     execute: async (input) => {
    //         return await funcHandlerAsync(
    //             async () => {
    //                 const response =
    //                     await this.userLogService.getUserLogSummaryReportByUserId(
    //                         input.userId,
    //                         input.startDate ? new Date(input.startDate) : undefined,
    //                         input.endDate ? new Date(input.endDate) : undefined
    //                     );
    //                 if (!response.success) {
    //                     return { success: false, error: 'Failed to fetch user log summary report.' };
    //                 }
    //                 return { success: true, data: response.data || '' };
    //             },
    //             'Error occurred while fetching user log summary report.',
    //             true
    //         );
    //     }
    // });

    /**
     * Lấy bản tóm tắt log đã được AI tóm tắt sẵn (summary table) của user.
     * Nhanh hơn getUserActivityReport vì đọc từ cache/DB summary.
     */
    getUserLogSummaryReportPerWeek: Tool = tool({
        description:
            'Get a pre-generated AI summary report of a user\'s activity logs. ' +
            'Faster than getUserActivityReport as it reads from saved summaries. ' +
            'Use this when you need a quick overview of what the user has been doing.' +
            'Nên dùng cho chatbot và recommendation.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getUserLogSummaryReportByUserId(
                            input.userId
                        );
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user log summary report.' };
                    }
                    return { success: true, data: response.data || '' };
                },
                'Error occurred while fetching user log summary report.',
                true
            );
        }
    });

    /**
     * Lấy bản tóm tắt log đã được AI tóm tắt sẵn (summary table) của user.
     * Nhanh hơn getUserActivityReport vì đọc từ cache/DB summary.
     */
    getUserLogSummaryReportPerMonth: Tool = tool({
        description:
            'Get a pre-generated AI summary report of a user\'s activity logs. ' +
            'Faster than getUserActivityReport as it reads from saved summaries. ' +
            'Use this when you need a quick overview of what the user has been doing.' +
            'Có thể dùng cho chatbot và recommendation nhưng không khuyên khích, tốt nhất là dùng cho trend và phân tích',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getUserLogSummaryReportByUserId(
                            input.userId
                        );
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user log summary report.' };
                    }
                    return { success: true, data: response.data || '' };
                },
                'Error occurred while fetching user log summary report.',
                true
            );
        }
    });

    /**
     * Lấy bản tóm tắt log đã được AI tóm tắt sẵn (summary table) của user.
     * Nhanh hơn getUserActivityReport vì đọc từ cache/DB summary.
     */
    getUserLogSummaryReportPerYear: Tool = tool({
        description:
            'Get a pre-generated AI summary report of a user\'s activity logs. ' +
            'Faster than getUserActivityReport as it reads from saved summaries. ' +
            'Use this when you need a quick overview of what the user has been doing.' +
            'Có thể dùng cho chatbot và recommendation nhưng không khuyên khích, tốt nhất là dùng cho trend và phân tích',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getUserLogSummaryReportByUserId(
                            input.userId
                        );
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user log summary report.' };
                    }
                    return { success: true, data: response.data || '' };
                },
                'Error occurred while fetching user log summary report.',
                true
            );
        }
    });

    // /**
    //  * Lấy danh sách các bản tóm tắt log của user theo khoảng thời gian.
    //  */
    // getUserLogSummaries: Tool = tool({
    //     description:
    //         'Get a list of saved log summaries for a user within a date range. ' +
    //         'Returns multiple summary entries, each covering a specific time window.',
    //     inputSchema: z.object({
    //         userId: z.string().describe('The ID of the user'),
    //         startDate: z.string().describe('Start date in ISO format'),
    //         endDate: z.string().describe('End date in ISO format')
    //     }),
    //     execute: async (input) => {
    //         return await funcHandlerAsync(
    //             async () => {
    //                 const response =
    //                     await this.userLogService.getUserLogSummariesByUserId(
    //                         input.userId,
    //                         new Date(input.startDate),
    //                         new Date(input.endDate)
    //                     );
    //                 if (!response.success) {
    //                     return { success: false, error: 'Failed to fetch user log summaries.' };
    //                 }
    //                 return { success: true, data: response.data || [] };
    //             },
    //             'Error occurred while fetching user log summaries.',
    //             true
    //         );
    //     }
    // });

    /**
   * Lấy danh sách các bản tóm tắt log của user theo khoảng thời gian.
   */
    getUserLogSummariesPerWeek: Tool = tool({
        description:
            'Get a list of saved log summaries for a user within a date range. ' +
            'Returns multiple summary entries, each covering a specific time window.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getUserLogSummariesByUserId(
                            input.userId
                        );
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user log summaries.' };
                    }
                    return { success: true, data: response.data || [] };
                },
                'Error occurred while fetching user log summaries.',
                true
            );
        }
    });

    /**
   * Lấy danh sách các bản tóm tắt log của user theo khoảng thời gian.
   */
    getUserLogSummariesPerMonth: Tool = tool({
        description:
            'Get a list of saved log summaries for a user within a date range. ' +
            'Returns multiple summary entries, each covering a specific time window.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getUserLogSummariesByUserId(
                            input.userId
                        );
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user log summaries.' };
                    }
                    return { success: true, data: response.data || [] };
                },
                'Error occurred while fetching user log summaries.',
                true
            );
        }
    });

    /**
   * Lấy danh sách các bản tóm tắt log của user theo khoảng thời gian.
   */
    getUserLogSummariesPerYear: Tool = tool({
        description:
            'Get a list of saved log summaries for a user within a date range. ' +
            'Returns multiple summary entries, each covering a specific time window.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user'),
            startDate: z.string().describe('Start date in ISO format'),
            endDate: z.string().describe('End date in ISO format')
        }),
        execute: async (input) => {
            return await funcHandlerAsync(
                async () => {
                    const response =
                        await this.userLogService.getUserLogSummariesByUserId(
                            input.userId
                        );
                    if (!response.success) {
                        return { success: false, error: 'Failed to fetch user log summaries.' };
                    }
                    return { success: true, data: response.data || [] };
                },
                'Error occurred while fetching user log summaries.',
                true
            );
        }
    });


}