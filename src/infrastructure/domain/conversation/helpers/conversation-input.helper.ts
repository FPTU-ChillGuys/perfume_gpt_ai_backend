import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import {
  processRequestForMobile,
  processResponseForMobile
} from 'src/infrastructure/domain/utils/message-helper';

@Injectable()
export class ConversationInputHelper {
  extractUserId(request: Request, fallbackUserId?: string): string {
    const fromToken = getTokenPayloadFromRequest(request)?.id;
    const resolved = fallbackUserId ?? fromToken;
    if (!resolved) {
      throw new BadRequestException(
        'userId is required — provide it in the request body or authenticate with a valid JWT token'
      );
    }
    return resolved;
  }

  resolveUserId(request: Request, chatRequest: ChatRequest): ChatRequest {
    chatRequest.userId = this.extractUserId(request, chatRequest.userId);
    return chatRequest;
  }

  processMobileRequest(chatRequest: ChatRequest): ChatRequest {
    return processRequestForMobile(chatRequest);
  }

  processMobileResponse(
    response: BaseResponse<ConversationResponse>,
    isMobile?: boolean
  ): BaseResponse<ConversationResponse> {
    return processResponseForMobile(response, isMobile);
  }

  prepareChatRequest(request: Request, chatRequest: ChatRequest): ChatRequest {
    this.resolveUserId(request, chatRequest);
    return this.processMobileRequest(chatRequest);
  }

  prepareStaffChatRequest(
    request: Request,
    chatRequest: ChatRequest
  ): ChatRequest {
    this.resolveUserId(request, chatRequest);
    chatRequest.isStaff = true;
    return this.processMobileRequest(chatRequest);
  }
}
