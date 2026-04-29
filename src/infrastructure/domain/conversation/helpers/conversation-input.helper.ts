import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { processRequestForMobile, processResponseForMobile } from 'src/infrastructure/domain/utils/message-helper';

@Injectable()
export class ConversationInputHelper {

  resolveUserId(request: Request, chatRequest: ChatRequest): ChatRequest {
    if (!chatRequest.userId) {
      chatRequest.userId = getTokenPayloadFromRequest(request)?.id;
    }

    if (!chatRequest.userId) {
      throw new BadRequestException('userId is required — provide it in the request body or authenticate with a valid JWT token');
    }

    return chatRequest;
  }

  /**
   * Xử lý convert ngược Object → String cho Request từ Mobile.
   * Mobile client gửi message dạng Object, cần stringify trước khi xử lý.
   */
  processMobileRequest(chatRequest: ChatRequest): ChatRequest {
    return processRequestForMobile(chatRequest);
  }

  /**
   * Xử lý parse message JSON cho Mobile Client (Response).
   * Nếu client là Mobile, parse JSON string trong assistant messages thành Object.
   */
  processMobileResponse(
    response: BaseResponse<ConversationResponse>,
    isMobile?: boolean
  ): BaseResponse<ConversationResponse> {
    return processResponseForMobile(response, isMobile);
  }

  /**
   * Chuẩn bị ChatRequest hoàn chỉnh: resolve userId + mobile processing.
   * Gộp 2 bước resolveUserId + processMobileRequest thành 1 call duy nhất.
   */
  prepareChatRequest(request: Request, chatRequest: ChatRequest): ChatRequest {
    this.resolveUserId(request, chatRequest);
    return this.processMobileRequest(chatRequest);
  }

  /**
   * Chuẩn bị ChatRequest cho Staff mode.
   * Tự động set isStaff = true.
   */
  prepareStaffChatRequest(request: Request, chatRequest: ChatRequest): ChatRequest {
    this.resolveUserId(request, chatRequest);
    chatRequest.isStaff = true;
    return this.processMobileRequest(chatRequest);
  }
}