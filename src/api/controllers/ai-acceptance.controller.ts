import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { BaseResponse } from "src/application/dtos/response/common/base-response";
import { AIAcceptance } from "src/domain/entities/ai-acceptance.entities";
import { AIAcceptanceService } from "src/infrastructure/servicies/ai-acceptance.service";
import { ApiBaseResponse } from "src/infrastructure/utils/api-response-decorator";

@ApiTags('AI Acceptance')
@Controller('ai-acceptance')
export class AIAcceptanceController {
  constructor(private readonly aiAcceptanceService: AIAcceptanceService) {}

  /** Cập nhật trạng thái chấp nhận AI theo ID */
  @Post(':id')
  @ApiOperation({ summary: 'Cập nhật trạng thái chấp nhận AI theo ID' })
  @ApiParam({ name: 'id', description: 'ID bản ghi AI acceptance' })
  @ApiQuery({ name: 'status', description: 'Trạng thái (true/false)' })
  @ApiBaseResponse(AIAcceptance)
  async updateAIAcceptanceData(@Param('id') id: string, @Query('status') status: string) : Promise<BaseResponse<AIAcceptance>> {
    return this.aiAcceptanceService.updateAIAcceptanceStatusById(id, status === 'true');
  }

  /** Lấy trạng thái chấp nhận AI theo user ID */
  @Get('status/:userId')
  @ApiOperation({ summary: 'Lấy trạng thái chấp nhận AI theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(AIAcceptance)
  async getAIAcceptanceStatus(@Param('userId') userId: string) {
    return this.aiAcceptanceService.getAIAcceptanceByUserId(userId);
  }

  /** Lấy tỷ lệ chấp nhận AI theo trạng thái */
  @Get('rate')
  @ApiOperation({ summary: 'Lấy tỷ lệ chấp nhận AI theo trạng thái' })
  @ApiQuery({ name: 'isAccepted', required: true, description: 'Trạng thái chấp nhận (true/false)' })
  @ApiBaseResponse(Number)
  async getAIAcceptanceRate(@Query('isAccepted') isAccepted: string) {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatus(isAccepted === 'true');
  }

  /** Lấy tỷ lệ chấp nhận AI theo user ID */
  @Get('rate/:userId')
  @ApiOperation({ summary: 'Lấy tỷ lệ chấp nhận AI theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(Number)
  async getAIAcceptanceRateByUserId(@Param('userId') userId: string) {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatusWithUserId(userId);
  }

  /** Tạo bản ghi chấp nhận AI mới cho người dùng */
  @Post('record/:userId')
  @ApiOperation({ summary: 'Tạo bản ghi chấp nhận AI mới' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiQuery({ name: 'isAccepted', required: true, description: 'Trạng thái chấp nhận (true/false)' })
  @ApiBaseResponse(AIAcceptance)
  async createAIAcceptanceRecord(@Param('userId') userId: string, @Query('isAccepted') isAccepted: string) {
    return this.aiAcceptanceService.createAIAcceptanceRecord(userId, isAccepted === 'false');
  }

}