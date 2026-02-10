import { Controller, Inject, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@ApiTags('AI')
@Controller('ai')
export class AIController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
  ) {}

  /** Tìm kiếm sản phẩm bằng AI */
  @Public()
  @Post('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng AI' })
  @ApiQuery({ name: 'prompt', description: 'Nội dung yêu cầu tìm kiếm' })
  @ApiBaseResponse(String)
  async searchProductWithAI(
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const aiResponse = await this.aiService.textGenerateFromPrompt(prompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return { success: true, data: aiResponse.data };
  }

}
