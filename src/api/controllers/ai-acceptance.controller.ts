import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiQuery } from "@nestjs/swagger";
import { AIAcceptanceService } from "src/infrastructure/servicies/ai-acceptance.service";

@Controller('ai-acceptance')
export class AIAcceptanceController {
  // Implement AI acceptance-related endpoints here
  constructor(private readonly aiAcceptanceService: AIAcceptanceService) {}

  // Update AI acceptance status by ID
  @Post(':id')
  async updateAIAcceptanceData(@Param('id') id: string, @Query('status') status: string) {
    return this.aiAcceptanceService.updateAIAcceptanceStatusById(id, status === 'true');
  }

  // Get AI acceptance status by user ID
  @Get('status/:userId')
  @ApiQuery({ name: 'userId', required: true, description: 'User ID to fetch AI acceptance status for' })
  async getAIAcceptanceStatus(@Param('userId') userId: string) {
    return this.aiAcceptanceService.getAIAcceptanceByUserId(userId);
  }

  // Get AI acceptance rate by acceptance status
  @Get('rate')
  @ApiQuery({ name: 'isAccepted', required: true, description: 'Acceptance status to calculate rate for (true or false)' })
  async getAIAcceptanceRate(@Query('isAccepted') isAccepted: string) {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatus(isAccepted === 'true');
  }

  // Get AI acceptance rate by user ID
  @Get('rate/:userId')
  @ApiQuery({ name: 'userId', required: true, description: 'User ID to fetch AI acceptance rate for' })
  async getAIAcceptanceRateByUserId(@Param('userId') userId: string) {
    return this.aiAcceptanceService.getAIAcceptanceRateByAcceptanceStatusWithUserId(userId);
  }

  // Create a new AI acceptance record for a user
  @Post('record/:userId')
  @ApiQuery({ name: 'isAccepted', required: true, description: 'Acceptance status for the new AI acceptance record (true or false)' })
  async createAIAcceptanceRecord(@Param('userId') userId: string, @Query('isAccepted') isAccepted: string) {
    return this.aiAcceptanceService.createAIAcceptanceRecord(userId, isAccepted === 'false');
  }

}