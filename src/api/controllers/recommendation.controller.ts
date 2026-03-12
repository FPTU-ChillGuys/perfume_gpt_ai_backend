import {
  Controller,
  Logger,
  Post,
  Query} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { RecommendationService } from 'src/infrastructure/servicies/recommandation.service';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  logger = new Logger(RecommendationController.name);

  constructor(private readonly recommendationService: RecommendationService) {}

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
}
