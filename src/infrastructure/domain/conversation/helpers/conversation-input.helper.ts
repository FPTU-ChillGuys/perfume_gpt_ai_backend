import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { Sender } from 'src/domain/enum/sender.enum';
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { processRequestForMobile, processResponseForMobile } from 'src/infrastructure/domain/utils/message-helper';

/**
 * Helper xử lý việc chuẩn hóa input/output cho Conversation.
 * - Trích xuất userId từ token
 * - Xử lý mobile request/response transformation
 */
@Injectable()
export class ConversationInputHelper {

  /**
   * Trích xuất userId từ JWT token trong request và gán vào ChatRequest.
   * Nếu request không có userId, sẽ lấy từ token payload.
   */
  resolveUserId(request: Request, chatRequest: ChatRequest): ChatRequest {
    if (!chatRequest.userId) {
      chatRequest.userId = getTokenPayloadFromRequest(request)?.id;
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