import { UserLogService } from "src/infrastructure/servicies/user-log.service";
import { PeriodEnum } from "src/domain/enum/period.enum";

export class UserLogHelper {

    constructor(
        protected userLogService: UserLogService
    ) { }

    /** Ghi de log theo tuan */
    async overrideWeeklyLogSummaryByUserId(userId: string): Promise<void> {
        await this.userLogService.summarizeAndSaveForUser(userId, PeriodEnum.WEEKLY);
    }

    /** Ghi de log theo thang */
    async overrideMonthlyLogSummaryByUserId(userId: string): Promise<void> {
        await this.userLogService.summarizeAndSaveForUser(userId, PeriodEnum.MONTHLY);
    }

    /** Ghi de log theo nam */
    async overrideYearlyLogSummaryByUserId(userId: string): Promise<void> {
        await this.userLogService.summarizeAndSaveForUser(userId, PeriodEnum.YEARLY);
    }

}
