import { UIMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageRequest } from 'src/application/dtos/request/conversation/chat-message.request';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { Sender } from 'src/domain/enum/sender.enum';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';
import {
  ConversationOutputDto,
  ProductCardOutputItemDto,
  ProductTempItemDto
} from 'src/application/dtos/common/conversation-output.dto';

/** Chuyển đổi danh sách tin nhắn request sang định dạng UIMessage cho AI SDK */
export function convertToMessages(messages: ChatMessageRequest[]): UIMessage[] {
  return messages.map((msgReq) => ({
    id: uuidv4(),
    role:
      msgReq.sender.toString().toLowerCase() === 'user' ? 'user' : 'assistant',
    parts: [
      {
        type: 'text',
        text: msgReq.message
      }
    ]
  }));
}

/** Thêm tin nhắn từ AI vào danh sách tin nhắn hiện có */
export const addMessageToMessages = (
  aiMessage: string,
  existingMessages: ChatMessageRequest[]
): ChatMessageRequest[] => {
  const newAssistantMessage = new ChatMessageRequest();
  newAssistantMessage.sender = Sender.ASSISTANT;
  newAssistantMessage.message = aiMessage;

  return [...existingMessages, newAssistantMessage];
};

/** Tạo đối tượng hội thoại tổng hợp để lưu trữ hoặc gửi vào queue */
export const overrideMessagesToConversation = (
  conversationId: string,
  userId: string,
  messages: ChatMessageRequest[]
): ChatRequest => {
  const request = new ChatRequest();
  request.id = conversationId;
  request.userId = userId;
  request.messages = messages;
  return request;
};

/**
 * Xử lý Request từ Mobile: gộp structured fields vào message string để persist.
 * Nếu message có products/suggestedQuestions/productTemp, stringify toàn bộ.
 */
export const processRequestForMobile = (request: ChatRequest): ChatRequest => {
  if (request.messages && Array.isArray(request.messages)) {
    request.messages = request.messages.map((msg) => {
      const hasStructuredData =
        (msg.products && msg.products.length > 0) ||
        (msg.suggestedQuestions && msg.suggestedQuestions.length > 0) ||
        (msg.productTemp && msg.productTemp.length > 0);

      if (hasStructuredData) {
        msg.message = JSON.stringify({
          message: msg.message,
          products: msg.products ?? null,
          productTemp: msg.productTemp ?? null,
          suggestedQuestions: msg.suggestedQuestions ?? null
        });
        msg.products = null;
        msg.productTemp = null;
        msg.suggestedQuestions = null;
      }
      return msg;
    });
  }
  return request;
};

/**
 * Parse JSON message từ DB thành flat fields cho Mobile Client.
 * Assistant: bóc message text + products + suggestedQuestions ra flat fields.
 */
export const processResponseForMobile = (
  response: BaseResponse<ConversationResponse>,
  isMobile?: boolean
): BaseResponse<ConversationResponse> => {
  if (isMobile && response.success && response.data?.messages) {
    response.data.isMobile = true;
    response.data.messages = response.data.messages.map((msg) => {
      if (msg.sender === Sender.ASSISTANT && typeof msg.message === 'string') {
        const parsed = tryParseAssistantJson(msg.message);
        if (parsed) {
          msg.message = parsed.message || '';
          msg.products = parsed.products;
          msg.productTemp = parsed.productTemp;
          msg.suggestedQuestions = parsed.suggestedQuestions ?? null;
        } else {
          msg.products = null;
          msg.productTemp = null;
          msg.suggestedQuestions = null;
        }
      } else {
        msg.products = null;
        msg.productTemp = null;
        msg.suggestedQuestions = null;
      }
      return msg;
    });
  }
  return response;
};

/**
 * Parse JSON string từ DB thành ConversationOutputDto.
 * Hỗ trợ double-stringified JSON (wrapped in quotes).
 * Trả về null nếu không phải JSON hợp lệ.
 */
function tryParseAssistantJson(raw: string): ConversationOutputDto | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) {
    return null;
  }

  try {
    let parsed: unknown = trimmed;

    // Handle double-stringified: "\"{...}\""
    if (trimmed.startsWith('"')) {
      const unquoted = JSON.parse(trimmed);
      if (typeof unquoted === 'string') {
        parsed = unquoted;
      } else {
        parsed = unquoted;
      }
    }

    // Parse final layer
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    return {
      message: typeof obj.message === 'string' ? obj.message : '',
      products: mapProducts(obj.products),
      productTemp: mapProductTemp(obj.productTemp),
      suggestedQuestions: mapSuggestedQuestions(obj.suggestedQuestions) ?? undefined
    };
  } catch {
    return null;
  }
}

/** Map products array từ parsed JSON sang ProductCardOutputItemDto[] */
function mapProducts(raw: unknown): ProductCardOutputItemDto[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((item: any) => ({
    id: item.id ?? '',
    name: item.name ?? '',
    brandName: item.brandName ?? '',
    primaryImage: item.primaryImage ?? null,
    variants: Array.isArray(item.variants)
      ? item.variants.map((v: any) => ({
          id: v.id ?? '',
          sku: v.sku ?? '',
          volumeMl: v.volumeMl ?? 0,
          basePrice: v.basePrice ?? 0
        }))
      : [],
    reasoning: item.reasoning ?? null,
    source: item.source ?? null
  }));
}

/** Map productTemp array từ parsed JSON sang ProductTempItemDto[] */
function mapProductTemp(raw: unknown): ProductTempItemDto[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((item: any) => ({
    id: item.id ?? '',
    name: item.name ?? null,
    variants: Array.isArray(item.variants)
      ? item.variants.map((v: any) => ({
          id: v.id ?? '',
          price: v.price ?? 0
        }))
      : null,
    reasoning: item.reasoning ?? '',
    source: item.source ?? ''
  }));
}

/** Map suggestedQuestions từ parsed JSON */
function mapSuggestedQuestions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((q): q is string => typeof q === 'string');
}