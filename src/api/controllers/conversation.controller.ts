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
  ApiTags
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import {
  ConversationDto,
  ConversationRequestDto
} from 'src/application/dtos/common/conversation.dto';
import { PagedConversationRequest } from 'src/application/dtos/request/paged-conversation.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ConversationService } from 'src/infrastructure/domain/conversation/conversation.service';
import { ConversationV9Service } from 'src/infrastructure/domain/conversation/conversation-v9.service';
import { ConversationV10Service } from 'src/infrastructure/domain/conversation/conversationV10.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';

@ApiTags('Conversation')
@Controller('conversation')
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private conversationV9Service: ConversationV9Service,
    private conversationV10Service: ConversationV10Service
  ) {}

  /** Lấy tất cả cuộc hội thoại */
  @Role(['admin'])
  @Get()
  @ApiOperation({ summary: 'Lấy tất cả cuộc hội thoại' })
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }

  /** Lấy cuộc hội thoại theo ID */
  @Role(['admin'])
  @Get(':id')
  @ApiOperation({ summary: 'Lấy cuộc hội thoại theo ID' })
  @ApiQuery({ name: 'id', type: String })
  async getConversationById(
    @Query('id') id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await this.conversationService.getConversationById(id);
  }

  /** Lấy danh sách cuộc hội thoại có phân trang */
  @Role(['admin'])
  @Get('list/paged')
  @ApiOperation({ summary: 'Lấy danh sách cuộc hội thoại có phân trang' })
  @ApiBaseResponse(PagedResult<ConversationDto>)
  async getAllConversationsPaginated(
    @Query() request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationDto>>> {
    return await this.conversationService.getAllConversationsPaginated(request);
  }

  /** Chat V8 - sử dụng buildCombinedPromptV5 + queue_with_userid */
  @Public()
  @Post('chat/v8')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V8' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV8(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    if (!conversation.userId) {
      conversation.userId = getTokenPayloadFromRequest(request)?.id;
    }
    return this.conversationService.chat(conversation);
  }

  /** Chat V9 - sử dụng Local NLP và Recommendation V2 Engine */
  @Public()
  @Post('chat/v9')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V9 (Local NLP + Recommended V2)' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV9(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    if (!conversation.userId) {
      conversation.userId = getTokenPayloadFromRequest(request)?.id;
    }
    return this.conversationV9Service.chatV9(conversation);
  }

  @Public()
  @Post('chat/v10')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V10 (Profile-first + Structured Search)' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV10(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    if (!conversation.userId) {
      conversation.userId = getTokenPayloadFromRequest(request)?.id;
    }
    return this.conversationV10Service.chat(conversation);
  }
}
