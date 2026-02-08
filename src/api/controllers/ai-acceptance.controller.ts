import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AIAcceptanceService } from "src/infrastructure/servicies/ai-acceptance.service";

@Controller('ai-acceptance')
export class AIAcceptanceController {
  // Implement AI acceptance-related endpoints here
  constructor(private readonly aiAcceptanceService: AIAcceptanceService) {}

  @Post(':id')
  async updateAIAcceptanceData(@Param('id') id: string, @Query('status') status: string) {
    return this.aiAcceptanceService.updateAIAcceptanceStatusById(id, status === 'true');
  }

  @Get('status/:userId')
  async getAIAcceptanceStatus(@Param('userId') userId: string) {
    return this.aiAcceptanceService.getAIAcceptanceByUserId(userId);
  }

  @Get('rate')
  async getAIAcceptanceRate(@Query('isAccepted') isAccepted: string) {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatus(isAccepted === 'true');
  }

  @Get('rate/:userId')
  async getAIAcceptanceRateByUserId(@Param('userId') userId: string) {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatusWithUserId(userId);
  }

  @Post('record/:userId')
  async createAIAcceptanceRecord(@Param('userId') userId: string, @Query('isAccepted') isAccepted: string) {
    return this.aiAcceptanceService.createAIAcceptanceRecord(userId, isAccepted === 'false');
  }

}