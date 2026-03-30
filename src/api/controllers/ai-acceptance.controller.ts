import { Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';

@ApiTags('AI Acceptance')
@Public()
@ApiUnauthorizedResponse({
  description: 'Token JWT không hợp lệ hoặc không được cung cấp'
})
@Controller('ai-acceptance')
export class AIAcceptanceController {
  constructor(private readonly aiAcceptanceService: AIAcceptanceService) {}

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
    @Query('status') status: boolean
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.updateAIAcceptanceStatusById(
      id,
      cartItemId,
      status
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
    @Query('status') status: boolean,
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.updateAIAcceptanceByUserIdAndCartId(
      userId,
      cartItemId,
      status
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

  /** Lấy tỷ lệ chấp nhận AI theo trạng thái */
  @Get('rate')
  @ApiOperation({ summary: 'Lấy tỷ lệ chấp nhận AI theo trạng thái' })
  @ApiQuery({
    name: 'isAccepted',
    required: true,
    description: 'Trạng thái chấp nhận (true/false)'
  })
  @ApiBaseResponse(Number)
  async getAIAcceptanceRate(
    @Query('isAccepted') isAccepted: string
  ): Promise<BaseResponse<number>> {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatus(
      isAccepted === 'true'
    );
  }

  /** Lấy tỷ lệ chấp nhận AI theo user ID */
  @Get('rate/:userId')
  @ApiOperation({ summary: 'Lấy tỷ lệ chấp nhận AI theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(Number)
  async getAIAcceptanceRateByUserId(
    @Param('userId') userId: string
  ): Promise<BaseResponse<number>> {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatusWithUserId(
      userId
    );
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
