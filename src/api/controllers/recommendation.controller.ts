import {
  Controller,
  Get,
  Logger,
  Post,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  DailyRecommendationBatchSummary,
  RecommendationService
} from 'src/infrastructure/domain/recommendation/recommandation.service';
import { RecommendationResponse } from 'src/infrastructure/domain/recommendation/recommendation-profile.type';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  logger = new Logger(RecommendationController.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly aiAcceptanceService: AIAcceptanceService
  ) { }

  /**
   * Test recommendation API
   * Sinh ra recommendation cho một user
   */
  @Public()
  @Post('test-recommendation')
  @ApiOperation({ summary: 'Test sinh recommendation cho user và gửi email' })
  @ApiQuery({
    name: 'userId',
    description: 'ID của user để test recommendation'
  })
  @ApiBaseResponse(String)
  async testRecommendation(
    @Query('userId') userId: string
  ): Promise<BaseResponse<string>> {
    await this.recommendationService.sendRecommendation(userId);
    return Ok('Recommendation generated and email sent successfully');
  }

  /**
   * Test repurchase recommendation API
   * Sinh ra repurchase recommendation cho một user và gửi email
   */
  @Public()
  @Post('test-repurchase')
  @ApiOperation({
    summary: 'Test sinh repurchase recommendation cho user và gửi email'
  })
  @ApiQuery({
    name: 'userId',
    description: 'ID của user để test repurchase recommendation'
  })
  @ApiQuery({
    name: 'orderId',
    required: true,
    description: 'ID của đơn hàng để phân tích khuyến nghị'
  })
  @ApiBaseResponse(String)
  async testRepurchase(
    @Query('userId') userId: string,
    @Query('orderId') orderId: string
  ): Promise<BaseResponse<string>> {
    await this.recommendationService.sendRepurchase(userId, orderId);
    return Ok('Repurchase recommendation generated and email sent successfully');
  }

  @Post('daily/send')
  @Role(['admin'])
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Manual trigger gửi daily recommendation cho user active (sync)'
  })
  @ApiBaseResponse(Object)
  async sendDailyRecommendationManual(): Promise<
    BaseResponse<DailyRecommendationBatchSummary>
  > {
    const summary = await this.recommendationService.sendRecommendationToAllUsers(
      'manual'
    );
    return Ok(summary);
  }


  /**
   * Get simple robust practical recommendations (V3)
   * Dựa trên:
   * - Lịch sử mua hàng TẤT CẢ các trạng thái
   * - Mở rộng với Best Sellers (Luôn có kết quả trả về)
   */
  @Public()
  @Get('v3/simple')
  @ApiOperation({
    summary:
      'Recommend đơn giản và ổn định dựa trên Order và Best Sellers (không fallback mảng rỗng)'
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'ID của user cần recommend'
  })
  @ApiQuery({
    name: 'size',
    required: false,
    type: Number,
    description: 'Số sản phẩm recommend (default: 10)'
  })
  @ApiBaseResponse(Object)
  async getRecommendationsV3Simple(
    @Query('userId') userId: string,
    @Query('size') size?: number
  ): Promise<BaseResponse<any>> {
    const result = await this.recommendationService.getRecommendationsSimple(
      userId,
      size || 10
    );

    if (result.success && result.data?.recommendations?.length) {
      const attachResult = await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
        contextType: 'recommendation',
        sourceRefId: `recommendation-v3-simple-${userId}-${Date.now()}`,
        products: result.data.recommendations,
        metadata: {
          sizeRequested: size || 10,
          productCount: result.data.recommendations.length
        }
      });

      result.data.recommendations = attachResult.products as any;
      if (attachResult.aiAcceptanceId) {
        (result.data as any).aiAcceptanceId = attachResult.aiAcceptanceId;
      }
    }

    return result;
  }
}

