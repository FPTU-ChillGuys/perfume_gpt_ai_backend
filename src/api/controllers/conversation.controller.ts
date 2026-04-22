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
import { ConversationV10Service } from 'src/infrastructure/domain/conversation/conversationV10.service';
import { ApiBaseResponse, ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';

@ApiTags('Conversation')
@Controller('conversation')
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private conversationV10Service: ConversationV10Service
  ) { }

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

  @Public()
  @Post('chat/v10-staff')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V10 Staff (Quick Counter Consultation Mode)' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV10Staff(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    if (!conversation.userId) {
      conversation.userId = getTokenPayloadFromRequest(request)?.id;
    }
    conversation.isStaff = true;
    return this.conversationV10Service.chat(conversation);
  }
}
