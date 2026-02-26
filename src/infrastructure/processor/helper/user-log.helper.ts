import { Inject } from "@nestjs/common";
import { endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { INSTRUCTION_TYPE_LOG } from "src/application/constant/prompts";
import { UserLogRequest } from "src/application/dtos/request/user-log.request";
import { BaseResponse } from "src/application/dtos/response/common/base-response";
import { PeriodEnum } from "src/domain/enum/period.enum";
import { AI_SERVICE } from "src/infrastructure/modules/ai.module";
import { AdminInstructionService } from "src/infrastructure/servicies/admin-instruction.service";
import { AIService } from "src/infrastructure/servicies/ai.service";
import { UserLogService } from "src/infrastructure/servicies/user-log.service";
import { funcHandlerAsync } from "src/infrastructure/utils/error-handler";
import { isDataEmpty, INSUFFICIENT_DATA_MESSAGES } from "src/infrastructure/utils/insufficient-data";
import { convertToUTC } from "src/infrastructure/utils/time-zone";

export class UserLogHelper {

    constructor(
        protected userLogService: UserLogService,
        protected adminInstructionService: AdminInstructionService,
        @Inject(AI_SERVICE) protected aiService: AIService
    ) { }

    /**Ghi de log theo tuan */
    async overrideWeeklyLogSummaryByUserId(userId: string): Promise<void> {
        const currentDate = new Date();
        const endDate = endOfWeek(convertToUTC(currentDate));
        const startDate = startOfWeek(convertToUTC(currentDate));
        const logSumaryResponse = await this.createLogSummaryForPeriodByUsingAI(userId, PeriodEnum.WEEKLY);
        if (!logSumaryResponse.success || !logSumaryResponse.data) {
            console.log(`Failed to create log summary for userId: ${userId}`);
            return;
        }
        await this.userLogService.saveUserLogSummary(userId, startDate, endDate, logSumaryResponse.data);

    }

    /** Ghi de log theo thang */
    async overrideMonthlyLogSummaryByUserId(userId: string): Promise<void> {
        const currentDate = new Date();
        const endDate = endOfMonth(convertToUTC(currentDate));
        const startDate = startOfMonth(convertToUTC(currentDate));
        const logSumaryResponse = await this.createLogSummaryForPeriodByUsingAI(userId, PeriodEnum.MONTHLY);
        if (!logSumaryResponse.success || !logSumaryResponse.data) {
            console.log(`Failed to create log summary for userId: ${userId}`);
            return;
        }
        await this.userLogService.saveUserLogSummary(userId, startDate, endDate, logSumaryResponse.data);
    }

    /** Ghi de log theo nam */
    async overrideYearlyLogSummaryByUserId(userId: string): Promise<void> {
        const currentDate = new Date();
        const endDate = endOfYear(convertToUTC(currentDate));
        const startDate = startOfYear(convertToUTC(currentDate));
        const logSumaryResponse = await this.createLogSummaryForPeriodByUsingAI(userId, PeriodEnum.YEARLY);
        if (!logSumaryResponse.success || !logSumaryResponse.data) {
            console.log(`Failed to create log summary for userId: ${userId}`);
            return;
        }
        await this.userLogService.saveUserLogSummary(userId, startDate, endDate, logSumaryResponse.data);
    }

    /** Tạo summary cho period */
    async createLogSummaryForPeriodByUsingAI(userId: string, period: PeriodEnum): Promise<BaseResponse<string | null>> {
        return await funcHandlerAsync(
            async () => {
                const userLogRequest = new UserLogRequest({
                    userId,
                    period,
                    endDate: new Date()
                });

                const response = await this.userLogService.getReportAndPromptSummaryUserLogs(userLogRequest);

                if (!response.success) {
                    return { success: false, error: 'Failed to get user logs' };
                }

                if (isDataEmpty(response.data?.prompt)) {
                    return { success: false, error: INSUFFICIENT_DATA_MESSAGES.LOG_SUMMARIZE };
                }

                // Lấy admin instruction cho domain log (nếu có)
                const adminPrompt =
                    await this.adminInstructionService.getSystemPromptForDomain(
                        INSTRUCTION_TYPE_LOG
                    );

                // Summarize with AI
                const aiResponse = await this.aiService.textGenerateFromPrompt(
                    response.data!.prompt,
                    adminPrompt
                );

                if (!aiResponse.success) {
                    return { success: false, error: 'Failed to generate summary with AI' };
                }

                return { success: true, data: aiResponse.data };
            },
            'Failed to create log summary with AI',
            true
        );
    }

}
