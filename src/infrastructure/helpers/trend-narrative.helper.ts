import { Inject, Injectable } from '@nestjs/common';
import { AllUserLogRequest } from 'src/application/dtos/request/user-log.request';
import {
  trendForecastingPrompt,
  INSTRUCTION_TYPE_TREND
} from 'src/application/constant/prompts';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AIHelper } from './ai.helper';
import { AI_TREND_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from '../servicies/admin-instruction.service';

type RankedTrendItemForNarrative = {
  productId: string;
  productName: string;
  trendScore: number;
  confidence: number;
  badgeType: 'Rising' | 'New' | 'Stable';
  reasonCodes: string[];
  last7DaysSales: number;
  last30DaysSales: number;
};

@Injectable()
export class TrendNarrativeHelper {
  constructor(
    @Inject(AI_TREND_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService
  ) {}

  private buildFallbackNarrative(
    rankedItems: RankedTrendItemForNarrative[],
    analyzedLogCount: number
  ): string {
    if (rankedItems.length === 0) {
      return 'Hiện chưa đủ dữ liệu để xác định sản phẩm đang tăng xu hướng. Vui lòng thử lại khi có thêm dữ liệu bán hàng và hành vi người dùng.';
    }

    const topNames = rankedItems
      .slice(0, 3)
      .map((item) => item.productName)
      .join(', ');

    return `Xu hướng hiện tại ưu tiên ${topNames}. Báo cáo đang kết hợp tín hiệu bán chạy, dữ liệu doanh số 7/30 ngày và hành vi người dùng (tổng ${analyzedLogCount} sự kiện).`;
  }

  private toPeriodEnum(period?: PeriodEnum): PeriodEnum {
    if (period === PeriodEnum.WEEKLY || period === PeriodEnum.YEARLY) {
      return period;
    }

    return PeriodEnum.MONTHLY;
  }

  async generateNarrative(
    allUserLogRequest: AllUserLogRequest,
    rankedItems: RankedTrendItemForNarrative[],
    analyzedLogCount: number
  ): Promise<string> {
    if (rankedItems.length === 0) {
      return this.buildFallbackNarrative(rankedItems, analyzedLogCount);
    }

    const rankedContext = {
      period: this.toPeriodEnum(allUserLogRequest.period),
      analyzedLogCount,
      topCandidates: rankedItems.slice(0, 10).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        trendScore: item.trendScore,
        confidence: item.confidence,
        badgeType: item.badgeType,
        reasonCodes: item.reasonCodes,
        last7DaysSales: item.last7DaysSales,
        last30DaysSales: item.last30DaysSales
      }))
    };

    const trendPrompt = trendForecastingPrompt(
      JSON.stringify(rankedContext, null, 2)
    );
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(
      INSTRUCTION_TYPE_TREND
    );
    const hybridInstruction =
      `${adminPrompt}\n[HYBRID RULE]\n` +
      '- Chỉ diễn giải dựa trên topCandidates đã cung cấp, không tự thêm sản phẩm ngoài danh sách.\n' +
      '- Viết ngắn gọn, nêu rõ vì sao sản phẩm đứng đầu và đề xuất 2-4 hành động thực thi.\n' +
      '- Không thay đổi trendScore, confidence hoặc reasonCodes.';

    const trendResponse = await this.aiHelper.textGenerateFromPrompt(
      trendPrompt,
      hybridInstruction
    );

    if (!trendResponse.success) {
      return this.buildFallbackNarrative(rankedItems, analyzedLogCount);
    }

    return trendResponse.data ?? this.buildFallbackNarrative(rankedItems, analyzedLogCount);
  }
}
