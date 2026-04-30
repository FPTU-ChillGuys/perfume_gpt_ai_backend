import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { ApiPublicErrorResponses } from 'src/application/decorators/swagger-error.decorator';
import { CreateResponseAIAcceptanceRequest } from 'src/application/dtos/request/ai-acceptance.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { AIAcceptanceContextType, AI_ACCEPTANCE_CONTEXTS } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.constants';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';

@ApiTags('AI Acceptance')
@Public()
@ApiPublicErrorResponses()
@Controller('ai-acceptance')
export class AIAcceptanceController {
  private readonly logger = new Logger(AIAcceptanceController.name);

  constructor(private readonly aiAcceptanceService: AIAcceptanceService) {}

  @Post('response')
  @ApiOperation({ summary: 'Tạo AI acceptance pending theo response-level (backend-first)' })
  @ApiBaseResponse(AIAcceptance)
  async createPendingResponseAcceptance(
    @Body() request: CreateResponseAIAcceptanceRequest
  ): Promise<BaseResponse<AIAcceptance>> {
    this.logger.log(`[POST] /ai-acceptance/response - contextType=${request.contextType}, sourceRefId=${request.sourceRefId}`);
    const result = await this.aiAcceptanceService.createPendingResponseAcceptance({
      contextType: request.contextType,
      sourceRefId: request.sourceRefId,
      productIds: request.productIds,
      visibleInHours: request.visibleInHours,
      metadata: request.metadata
    });
    this.logger.log(`[POST] /ai-acceptance/response result: success=${result.success}${result.data ? `, id=${result.data.id}` : ''}`);
    return result;
  }

  @Post('click/:aiAcceptanceId')
  @ApiOperation({ summary: 'Đánh dấu click chấp nhận theo aiAcceptanceId' })
  @ApiParam({ name: 'aiAcceptanceId', description: 'ID bản ghi AI acceptance' })
  @ApiBaseResponse(AIAcceptance)
  async clickAIAcceptance(
    @Param('aiAcceptanceId') aiAcceptanceId: string
  ): Promise<BaseResponse<AIAcceptance>> {
    this.logger.log(`[POST] /ai-acceptance/click/${aiAcceptanceId}`);
    const result = await this.aiAcceptanceService.markAcceptedByAcceptanceId(aiAcceptanceId);
    this.logger.log(`[POST] /ai-acceptance/click/${aiAcceptanceId} result: success=${result.success}`);
    return result;
  }

  @Get('status/all')
  @ApiOperation({
    summary: 'Lấy trạng thái chấp nhận AI của tất cả gợi ý'
  })
  @ApiBaseResponse(AIAcceptance)
  async getAllAIAcceptanceStatus(): Promise<
    BaseResponse<AIAcceptance[] | null>
  > {
    this.logger.log(`[GET] /ai-acceptance/status/all`);
    return this.aiAcceptanceService.getAllAIAcceptanceStatus();
  }

  /** Cập nhật trạng thái chấp nhận AI theo ID */
  @Post(':id')
  @ApiOperation({ summary: 'Cập nhật trạng thái chấp nhận AI theo ID' })
  @ApiParam({ name: 'id', description: 'ID bản ghi AI acceptance' })
  @ApiQuery({ name: 'status', description: 'Trạng thái (true/false)' })
  @ApiBaseResponse(AIAcceptance)
  async updateAIAcceptanceData(
    @Param('id') id: string,
    @Query('status') status: string
  ): Promise<BaseResponse<AIAcceptance>> {
    this.logger.log(`[POST] /ai-acceptance/${id} - status=${status}`);
    const result = await this.aiAcceptanceService.updateAIAcceptanceStatusById(
      id,
      status === 'true'
    );
    this.logger.log(`[POST] /ai-acceptance/${id} result: success=${result.success}`);
    return result;
  }

  /** Lấy tỷ lệ chấp nhận AI theo trạng thái */
  @Get('rate')
  @ApiOperation({ summary: 'Lấy tỷ lệ chấp nhận AI theo trạng thái' })
  @ApiQuery({
    name: 'isAccepted',
    required: true,
    description: 'Trạng thái chấp nhận (true/false)'
  })
  @ApiQuery({
    name: 'contextType',
    required: false,
    enum: AI_ACCEPTANCE_CONTEXTS,
    description: 'Lọc theo ngữ cảnh'
  })
  @ApiBaseResponse(Number)
  async getAIAcceptanceRate(
    @Query('isAccepted') isAccepted: string,
    @Query('contextType') contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<number>> {
    this.logger.log(`[GET] /ai-acceptance/rate - isAccepted=${isAccepted}, contextType=${contextType}`);
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatus(
      isAccepted === 'true',
      contextType
    );
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Lấy metrics acceptance theo context (accepted/pending/no-click)' })
  @ApiQuery({ name: 'contextType', required: false, enum: AI_ACCEPTANCE_CONTEXTS })
  @ApiBaseResponse(Object)
  async getAIAcceptanceMetrics(
    @Query('contextType') contextType?: AIAcceptanceContextType
  ) {
    this.logger.log(`[GET] /ai-acceptance/metrics - contextType=${contextType}`);
    return this.aiAcceptanceService.getAIAcceptanceMetrics(contextType);
  }
}
