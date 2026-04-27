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
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { ConversationOutputDto } from 'src/application/dtos/common/conversation-output.dto';
import { Sender } from 'src/domain/enum/sender.enum';

// New DTOs
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { PagedConversationRequest } from 'src/application/dtos/request/conversation/paged-conversation.request';

@ApiTags('Conversation')
@ApiExtraModels(ConversationOutputDto)
@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService
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

  /** Lấy danh sách cuộc hội thoại có phân trang (Admin) */
  @Role(['admin'])
  @Get('list/paged')
  @ApiOperation({ summary: 'Lấy danh sách cuộc hội thoại có phân trang' })
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
    if (!chatRequest.userId) {
      chatRequest.userId = getTokenPayloadFromRequest(request)?.id;
    }
    
    // Xử lý mobile input
    const processedReq = this.processRequestForMobile(chatRequest);
    
    const result = await this.conversationService.chat(processedReq);
    
    // Xử lý mobile output
    return this.processResponseForMobile(result, chatRequest.isMobile);
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
    if (!chatRequest.userId) {
      chatRequest.userId = getTokenPayloadFromRequest(request)?.id;
    }
    chatRequest.isStaff = true;
    
    // Xử lý mobile input
    const processedReq = this.processRequestForMobile(chatRequest);
    
    const result = await this.conversationService.chat(processedReq);
    
    // Xử lý mobile output
    return this.processResponseForMobile(result, chatRequest.isMobile);
  }

  /** Xử lý convert ngược Object -> String cho Request từ Mobile */
  private processRequestForMobile(request: ChatRequest): ChatRequest {
    if (request.messages && Array.isArray(request.messages)) {
      request.messages = request.messages.map(msg => {
        if (typeof msg.message !== 'string') {
          msg.message = JSON.stringify(msg.message);
        }
        return msg;
      });
    }
    return request;
  }

  /** Xử lý parse message JSON cho Mobile Client (Response) */
  private processResponseForMobile(
    response: BaseResponse<ConversationResponse>,
    isMobile?: boolean
  ): BaseResponse<ConversationResponse> {
    if (isMobile && response.success && response.data?.messages) {
      response.data.isMobile = true;
      response.data.messages = response.data.messages.map((msg) => {
        if (msg.sender === Sender.ASSISTANT && typeof msg.message === 'string') {
          const trimmed = msg.message.trim();
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
              // Ignore parse error
            }
          }
        }
        return msg;
      });
    }
    return response;
  }
}
