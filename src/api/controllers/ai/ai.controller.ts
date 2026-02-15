import { Controller, Inject, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { getTokenPayloadFromRequest } from 'src/infrastructure/utils/extract-token';
import { v4 as uuidv4 } from 'uuid';

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
     const userId = getTokenPayloadFromRequest(req)?.id;
    if (userId) {
      await this.userLog.addSearchLogToUserLog(userId, prompt);
    } else {
      // Tu tao moi uuid de luu log cho nguoi dung khong xac dinh
      const anonymousUserId = uuidv4();
      await this.userLog.addSearchLogToUserLog(anonymousUserId, prompt);
    }
    const aiResponse = await this.aiService.textGenerateFromPrompt(prompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return { success: true, data: aiResponse.data };
  }

}
