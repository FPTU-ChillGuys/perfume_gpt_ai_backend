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
import { ConversationOutputDto } from 'src/application/dtos/common/conversation-output.dto';
import { Sender } from 'src/domain/enum/sender.enum';

@ApiTags('Conversation')
@ApiExtraModels(ConversationOutputDto)
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

  /** Lấy danh sách cuộc hội thoại có phân trang */
  @Role(['admin'])
  @Get('list/paged')
  @ApiOperation({ summary: 'Lấy danh sách cuộc hội thoại có phân trang' })
  @ExtendApiBaseResponse(PagedResult, ConversationDto)
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


  @Public()
  @Post('chat/v10')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V10 (Profile-first + Structured Search)' })
  @ApiBaseResponse(ConversationDto)
  async conversationV10(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    if (!conversation.userId) {
      conversation.userId = getTokenPayloadFromRequest(request)?.id;
    }
    const processedReq = this.processRequestForMobile(conversation);
    const result = await this.conversationV10Service.chat(processedReq);
    return this.processResponseForMobile(result, conversation.isMobile);
  }

  @Public()
  @Post('chat/v10-staff')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Chat V10 Staff (Quick Counter Consultation Mode)' })
  @ApiBaseResponse(ConversationDto)
  async conversationV10Staff(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    if (!conversation.userId) {
      conversation.userId = getTokenPayloadFromRequest(request)?.id;
    }
    const processedReq = this.processRequestForMobile(conversation);
    processedReq.isStaff = true;
    const result = await this.conversationV10Service.chat(processedReq);
    return this.processResponseForMobile(result, conversation.isMobile);
  }

  /** Xử lý convert ngược Object -> String cho Request từ Mobile */
  private processRequestForMobile(conversation: ConversationRequestDto): ConversationRequestDto {
    if (conversation.messages && Array.isArray(conversation.messages)) {
      conversation.messages = conversation.messages.map(msg => {
        if (typeof msg.message !== 'string') {
          msg.message = JSON.stringify(msg.message);
        }
        return msg;
      });
    }
    return conversation;
  }

  /** Xử lý parse message JSON cho Mobile Client (Response) */
  private processResponseForMobile(
    response: BaseResponse<ConversationDto>,
    isMobile?: boolean
  ): BaseResponse<ConversationDto> {
    if (isMobile && response.success && response.data?.messages) {
      response.data.isMobile = true;
      response.data.messages = response.data.messages.map((msg) => {
        if (msg.sender === Sender.ASSISTANT && typeof msg.message === 'string') {
          const trimmed = msg.message.trim();
          // Kiểm tra xem có phải JSON không
          if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('"') && trimmed.includes('{'))
          ) {
            try {
              let parsed = msg.message;
              if (trimmed.startsWith('"')) {
                parsed = JSON.parse(parsed);
              }
              msg.message = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
            } catch (e) {
              // Parse lỗi thì giữ nguyên string
            }
          }
        }
        return msg;
      });
    }
    return response;
  }
}
