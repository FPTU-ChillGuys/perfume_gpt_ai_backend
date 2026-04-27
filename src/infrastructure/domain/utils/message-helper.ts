import { UIMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageRequest } from 'src/application/dtos/request/conversation/chat-message.request';
import { ChatRequest } from 'src/application/dtos/request/conversation/chat.request';

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
