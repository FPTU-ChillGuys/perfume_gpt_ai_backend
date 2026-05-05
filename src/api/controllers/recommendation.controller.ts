import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import {
  ApiAdminErrors,
  ApiPublicErrorResponses
} from 'src/application/decorators/swagger-error.decorator';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  DailyRecommendationBatchSummary,
  RecommendationService
} from 'src/infrastructure/domain/recommendation/recommandation.service';
import {
  RecommendationTestRequest,
  RepurchaseTestRequest,
  RecommendationV3SimpleRequest
} from 'src/application/dtos/request/recommendation/recommendation.request';
import {
  RecommendationResultResponse,
  DailyRecommendationBatchSummaryResponse
} from 'src/application/dtos/response/recommendation/recommendation-product.response';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  logger = new Logger(RecommendationController.name);

  constructor(
    private readonly recommendationService: RecommendationService
  ) {}

  @Public()
  @Post('test-recommendation')
  @ApiPublicErrorResponses()
  @ApiOperation({ summary: 'Test sinh recommendation cho user va gui email' })
  @ApiBaseResponse(RecommendationResultResponse)
  async testRecommendation(
    @Body() body: RecommendationTestRequest
  ): Promise<BaseResponse<RecommendationResultResponse>> {
    return this.recommendationService.sendRecommendation(body.userId);
  }

  @Public()
  @Post('test-repurchase')
  @ApiPublicErrorResponses()
  @ApiOperation({
    summary: 'Test sinh repurchase recommendation cho user va gui email'
  })
  @ApiBaseResponse(RecommendationResultResponse)
  async testRepurchase(
    @Body() body: RepurchaseTestRequest
  ): Promise<BaseResponse<RecommendationResultResponse>> {
    return this.recommendationService.sendRepurchase(body.userId, body.orderId);
  }

  @Post('daily/send')
  @Role(['admin'])
  @ApiBearerAuth('jwt')
  @ApiAdminErrors()
  @ApiOperation({
    summary: 'Manual trigger gửi daily recommendation cho user active (sync)'
  })
  @ApiBaseResponse(DailyRecommendationBatchSummaryResponse)
  async sendDailyRecommendationManual(): Promise<
    BaseResponse<DailyRecommendationBatchSummary>
  > {
    const summary =
      await this.recommendationService.sendRecommendationToAllUsers('manual');
    return Ok(summary);
  }

  @Public()
  @Get('v3/simple')
  @ApiPublicErrorResponses()
  @ApiOperation({
    summary:
      'Recommend đơn giản và ổn định dựa trên Order và Best Sellers (không fallback mảng rỗng)'
  })
  @ApiBaseResponse(RecommendationResultResponse)
  async getRecommendationsV3Simple(
    @Query() query: RecommendationV3SimpleRequest
  ): Promise<BaseResponse<RecommendationResultResponse>> {
    return this.recommendationService.getRecommendationsSimple(
      query.userId,
      query.size || 10
    );
  }
}
