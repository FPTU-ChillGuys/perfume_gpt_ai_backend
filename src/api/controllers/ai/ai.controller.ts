import { Controller, Inject, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AI_SERVICE } from 'src/infrastructure/domain/ai/ai.module';
import { AIService } from 'src/infrastructure/domain/ai/ai.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { resolveLogUserIdFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';

@ApiTags('AI')
@Controller('ai')
export class AIController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private readonly userLog: UserLogService
  ) {}

  /** Tìm kiếm sản phẩm bằng AI */
  @Public()
  @Post('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng AI' })
  @ApiQuery({ name: 'prompt', description: 'Nội dung yêu cầu tìm kiếm' })
  @ApiBaseResponse(String)
  async searchProductWithAI(
    @Req() req: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, prompt);
    const aiResponse = await this.aiService.textGenerateFromPrompt(prompt);
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI response', { service: 'AIService', prompt });
    }
    return Ok(aiResponse.data);
  }

}
