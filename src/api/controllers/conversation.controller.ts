import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiExtraModels
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ConversationService } from 'src/infrastructure/domain/conversation/conversation.service';
import { ApiBaseResponse, ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { ConversationOutputDto } from 'src/application/dtos/common/conversation-output.dto';
import { ConversationInputHelper } from 'src/infrastructure/domain/conversation/helpers/conversation-input.helper';

// DTOs
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { PagedConversationRequest } from 'src/application/dtos/request/conversation/paged-conversation.request';

@ApiTags('Conversation')
@ApiExtraModels(ConversationOutputDto)
@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly inputHelper: ConversationInputHelper
  ) { }

  /** Lấy tất cả cuộc hội thoại (Admin) */
  @Role(['admin'])
  @Get()
  @ApiOperation({ summary: 'Lấy tất cả cuộc hội thoại' })
  @ApiBaseResponse(ConversationResponse)
  async getAllConversations(): Promise<BaseResponse<ConversationResponse[]>> {
    return await this.conversationService.getAllConversations();
  }

  /** Lấy cuộc hội thoại theo ID (Admin) */
  @Role(['admin'])
  @Get(':id')
  @ApiOperation({ summary: 'Lấy cuộc hội thoại theo ID' })
  async getConversationById(
    @Query('id') id: string
  ): Promise<BaseResponse<ConversationResponse>> {
    return await this.conversationService.getConversationById(id);
  }

  /** Lấy danh sách hội thoại có phân trang (Admin) */
  @Role(['admin'])
  @Get('list/paged')
  @ApiOperation({ summary: 'Lấy danh sách hội thoại có phân trang' })
  @ExtendApiBaseResponse(PagedResult, ConversationResponse)
  async getAllConversationsPaginated(
    @Query() request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationResponse>>> {
    return await this.conversationService.getAllConversationsPaginated(request);
  }

  /** Chat chính - sử dụng logic V10 Advanced */
  @Public()
  @Post('chat/v10')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat với AI (Advanced V10 logic)' })
  @ApiBaseResponse(ConversationResponse)
  async chat(
    @Req() request: Request,
    @Body() chatRequest: ChatRequest
  ): Promise<BaseResponse<ConversationResponse>> {
    const prepared = this.inputHelper.prepareChatRequest(request, chatRequest);
    const result = await this.conversationService.chat(prepared);
    return this.inputHelper.processMobileResponse(result, chatRequest.isMobile);
  }

  /** Chat V10 Staff (Quick Counter Consultation Mode) */
  @Public()
  @Post('chat/v10-staff')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V10 Staff (Quick Counter Consultation Mode)' })
  @ApiBaseResponse(ConversationResponse)
  async chatStaff(
    @Req() request: Request,
    @Body() chatRequest: ChatRequest
  ): Promise<BaseResponse<ConversationResponse>> {
    const prepared = this.inputHelper.prepareStaffChatRequest(request, chatRequest);
    const result = await this.conversationService.chat(prepared);
    return this.inputHelper.processMobileResponse(result, chatRequest.isMobile);
  }
}
