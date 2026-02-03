import { UIMessage } from 'ai';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { MessageDto, MessageRequestDto } from 'src/application/dtos/common/message.dto';
import { Sender } from 'src/domain/enum/sender.enum';
import { v4 as uuidv4 } from 'uuid';

export function convertToMessages(message: MessageRequestDto[]): UIMessage[] {
  return message.map((msgReq) => ({
    id: uuidv4(),
    role:
      msgReq.sender.toString().toLocaleLowerCase() === 'user'
        ? 'user'
        : 'assistant',
    parts: [
      {
        type: 'text',
        text: msgReq.message
      }
    ]
  }));
}

export const convertToMessageResponse = (
  conversationId: string,
  message: UIMessage[]
): MessageDto[] => {
  return message.map((msg) => ({
    id: msg.id,
    conversationId: conversationId,
    sender: msg.role as Sender,
    message: msg.parts.find((part) => part.type === 'text')?.text || ''
  }));
};

export const addMessageToMessages = (
  message: string,
  messages: MessageDto[]
): MessageDto[] => {
  return [
    ...messages,
    {
      sender: 'assistant',
      message: message
    }
  ];
};

export const overrideMessagesToConversation = (
  conversationId: string,
  messages: MessageDto[]
): ConversationDto => {
  return {
    id: conversationId,
    messages: messages
  };
};

