import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { CreateResponseAIAcceptanceRequest } from 'src/application/dtos/request/ai-acceptance.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { AIAcceptanceContextType, AI_ACCEPTANCE_CONTEXTS } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.constants';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';

@ApiTags('AI Acceptance')
@Public()
@ApiUnauthorizedResponse({
  description: 'Token JWT không hợp lệ hoặc không được cung cấp'
})
@Controller('ai-acceptance')
export class AIAcceptanceController {
  constructor(private readonly aiAcceptanceService: AIAcceptanceService) {}

  @Post('response')
  @ApiOperation({ summary: 'Tạo AI acceptance pending theo response-level (backend-first)' })
  @ApiBaseResponse(AIAcceptance)
  async createPendingResponseAcceptance(
    @Body() request: CreateResponseAIAcceptanceRequest
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.createPendingResponseAcceptance({
      userId: request.userId,
      contextType: request.contextType,
      sourceRefId: request.sourceRefId,
      productIds: request.productIds,
      visibleInHours: request.visibleInHours,
      metadata: request.metadata
    });
  }

  @Post('click/:aiAcceptanceId')
  @ApiOperation({ summary: 'Đánh dấu click chấp nhận theo aiAcceptanceId' })
  @ApiParam({ name: 'aiAcceptanceId', description: 'ID bản ghi AI acceptance' })
  @ApiQuery({ name: 'userId', required: false, description: 'ID user để kiểm tra quyền sở hữu (optional)' })
  @ApiBaseResponse(AIAcceptance)
  async clickAIAcceptance(
    @Param('aiAcceptanceId') aiAcceptanceId: string,
    @Query('userId') userId?: string
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.markAcceptedByAcceptanceId(aiAcceptanceId, userId);
  }

  @Get('status/all')
  @ApiOperation({
    summary: 'Lấy trạng thái chấp nhận AI của tất cả người dùng'
  })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(AIAcceptance)
  async getAllAIAcceptanceStatus(): Promise<
    BaseResponse<AIAcceptance[] | null>
  > {
    return this.aiAcceptanceService.getAllAIAcceptanceStatus();
  }

  /** Cập nhật trạng thái chấp nhận AI theo ID */
  @Post(':id')
  @ApiOperation({ summary: 'Cập nhật trạng thái chấp nhận AI theo ID' })
  @ApiParam({ name: 'id', description: 'ID bản ghi AI acceptance' })
  @ApiQuery({ name: 'status', description: 'Trạng thái (true/false)' })
  @ApiQuery({ name: 'cartItemId', description: 'ID cart item liên quan (tùy chọn)', required: false })
  @ApiBaseResponse(AIAcceptance)
  async updateAIAcceptanceData(
    @Param('id') id: string,
    @Query('cartItemId') cartItemId: string,
    @Query('status') status: string
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.updateAIAcceptanceStatusById(
      id,
      cartItemId,
      status === 'true'
    );
  }

  @Put('user/:userId')
  @ApiOperation({ summary: 'Cập nhật trạng thái chấp nhận AI theo ID người dùng và ID cart item' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiQuery({ name: 'status', description: 'Trạng thái (true/false)' })
  @ApiQuery({ name: 'cartItemId', description: 'ID cart item liên quan (tùy chọn)', required: false })
  @ApiBaseResponse(AIAcceptance)
  async updateAIAcceptanceDataByUserIdAndCartId(
    @Param('userId') userId: string,
    @Query('cartItemId') cartItemId: string,
    @Query('status') status: string,
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.updateAIAcceptanceByUserIdAndCartId(
      userId,
      cartItemId,
      status === 'true'
    );
  }


  /** Lấy trạng thái chấp nhận AI theo user ID */
  @Get('status/:userId')
  @ApiOperation({ summary: 'Lấy trạng thái chấp nhận AI theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(AIAcceptance)
  async getAIAcceptanceStatus(
    @Param('userId') userId: string
  ): Promise<BaseResponse<AIAcceptance[] | null>> {
    return this.aiAcceptanceService.getAIAcceptanceByUserId(userId);
  }

  @Get('visible/:userId')
  @ApiOperation({ summary: 'Lấy trạng thái AI acceptance có thể hiển thị (accepted ngay, false sau 24h)' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiQuery({ name: 'contextType', required: false, enum: AI_ACCEPTANCE_CONTEXTS, description: 'Lọc theo ngữ cảnh' })
  @ApiBaseResponse(AIAcceptance)
  async getVisibleAIAcceptanceStatus(
    @Param('userId') userId: string,
    @Query('contextType') contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<AIAcceptance[]>> {
    return this.aiAcceptanceService.getVisibleAIAcceptanceByUserId(userId, contextType);
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
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatus(
      isAccepted === 'true',
      contextType
    );
  }

  /** Lấy tỷ lệ chấp nhận AI theo user ID */
  @Get('rate/:userId')
  @ApiOperation({ summary: 'Lấy tỷ lệ chấp nhận AI theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiQuery({
    name: 'contextType',
    required: false,
    enum: AI_ACCEPTANCE_CONTEXTS,
    description: 'Lọc theo ngữ cảnh'
  })
  @ApiBaseResponse(Number)
  async getAIAcceptanceRateByUserId(
    @Param('userId') userId: string,
    @Query('contextType') contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<number>> {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatusWithUserId(
      userId,
      contextType
    );
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Lấy metrics acceptance theo context/user (accepted/pending/no-click)' })
  @ApiQuery({ name: 'contextType', required: false, enum: AI_ACCEPTANCE_CONTEXTS })
  @ApiQuery({ name: 'userId', required: false })
  @ApiBaseResponse(Object)
  async getAIAcceptanceMetrics(
    @Query('contextType') contextType?: AIAcceptanceContextType,
    @Query('userId') userId?: string
  ) {
    return this.aiAcceptanceService.getAIAcceptanceMetrics(contextType, userId);
  }

  /** Tạo bản ghi chấp nhận AI mới cho người dùng */
  @Post('record/:userId')
  @ApiOperation({ summary: 'Tạo bản ghi chấp nhận AI mới' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiQuery({
    name: 'status',
    required: true,
    description: 'Trạng thái chấp nhận (true/false)'
  })
  @ApiQuery({
    name: 'cartItemId',
    required: false,
    description: 'ID cart item liên quan (tùy chọn)'
  })
  @ApiBaseResponse(AIAcceptance)
  async createAIAcceptanceRecord(
    @Param('userId') userId: string,
    @Query('cartItemId') cartItemId: string,
    @Query('status') status: string,
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.createAIAcceptanceRecord(
      userId,
      status === 'true',
      cartItemId
    );
  }
}
