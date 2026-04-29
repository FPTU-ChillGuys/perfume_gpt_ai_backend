import { UIMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageRequest } from 'src/application/dtos/request/conversation/chat-message.request';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';
import { Sender } from 'src/domain/enum/sender.enum';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ConversationResponse } from 'src/application/dtos/response/conversation/conversation.response';

/** Chuyển đổi danh sách tin nhắn request sang định dạng UIMessage cho AI SDK */
export function convertToMessages(messages: ChatMessageRequest[]): UIMessage[] {
  return messages.map((msgReq) => ({
    id: uuidv4(),
    role: msgReq.sender.toString().toLowerCase() === 'user' ? 'user' : 'assistant',
    parts: [
      {
        type: 'text',
        text: typeof msgReq.message === 'string' ? msgReq.message : JSON.stringify(msgReq.message)
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
  newAssistantMessage.sender = 'assistant' as any; // Cast for compatibility
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

/** Xử lý convert ngược Object -> String cho Request từ Mobile */
export const processRequestForMobile = (request: ChatRequest): ChatRequest => {
  if (request.messages && Array.isArray(request.messages)) {
    request.messages = request.messages.map((msg) => {
      if (typeof msg.message !== 'string') {
        msg.message = JSON.stringify(msg.message);
      }
      return msg;
    });
  }
  return request;
};

/** Xử lý parse message JSON cho Mobile Client (Response) */
export const processResponseForMobile = (
  response: BaseResponse<ConversationResponse>,
  isMobile?: boolean
): BaseResponse<ConversationResponse> => {
  if (isMobile && response.success && response.data?.messages) {
    response.data.isMobile = true;
    response.data.messages = response.data.messages.map((msg) => {
      if (msg.sender === Sender.ASSISTANT && typeof msg.message === 'string') {
        const trimmed = msg.message.trim();
        // Kiểm tra dấu hiệu của JSON
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('"') && trimmed.includes('{'))
        ) {
          try {
            let parsed = msg.message;
            if (trimmed.startsWith('"')) {
              parsed = JSON.parse(parsed);
            }
            // Parse lần 2 nếu kết quả vẫn là string (tránh double stringify)
            msg.message = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
          } catch (e) {
            // Bỏ qua nếu parse lỗi
          }
        }
      }
      return msg;
    });
  }
  return response;
};
