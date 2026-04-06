import {
  Controller,
  Get,
  Logger,
  Post,
  Query} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  DailyRecommendationBatchSummary,
  RecommendationService
} from 'src/infrastructure/domain/recommendation/recommandation.service';
import { RecommendationV2Service } from 'src/infrastructure/domain/recommendation/recommendation-v2.service';
import { RecommendationResponse } from 'src/infrastructure/domain/recommendation/recommendation-profile.type';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  logger = new Logger(RecommendationController.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly recommendationV2Service: RecommendationV2Service
  ) {}

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
  @ApiBaseResponse(String)
  async testRepurchase(
    @Query('userId') userId: string
  ): Promise<BaseResponse<string>> {
    await this.recommendationService.sendRepurchase(userId);
    return Ok('Repurchase recommendation generated and email sent successfully');
  }

  @Post('daily/send')
  @Role(['admin'])
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Manual trigger gửi daily recommendation V3 cho user active (sync)'
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
   * Get intelligent product recommendations (V2)
   * Dựa trên:
   * - Lịch sử mua hàng 2 năm gần đây
   * - Mùa hiện tại (summer/winter)
   * - Hồ sơ khảo sát (nốt hương, dịp, phong cách)
   * - Tuổi động (tính từ DateOfBirth)
   * - Ngân sách hàng tháng (tính từ lịch sử order)
   * - Tần suất tái mua (từ lịch sử đơn hàng)
   */
  @Public()
  @Get('v2')
  @ApiOperation({
    summary:
      'Thông minh recommend sản phẩm dựa trên 6 tiêu chí (mua/mùa/survey/tuổi/budget/tần suất)'
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
  async getRecommendationsV2(
    @Query('userId') userId: string,
    @Query('size') size?: number
  ): Promise<BaseResponse<RecommendationResponse>> {
    return await this.recommendationV2Service.getRecommendations(
      userId,
      size || 10
    );
  }
}
