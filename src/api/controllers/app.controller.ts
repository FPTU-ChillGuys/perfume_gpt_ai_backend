import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from '../../app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check - Kiểm tra trạng thái server' })
  @ApiResponse({ status: 200, description: 'Server đang hoạt động', type: String })
  checkHealth(): string {
    return this.appService.checkHealth();
  }
}
