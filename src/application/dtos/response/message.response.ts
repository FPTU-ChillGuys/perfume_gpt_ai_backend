import { Sender } from 'src/domain/enum/sender.enum';
import { CommonResponse } from './common/common.response';

export class MessageResponse extends CommonResponse {
  conversationId!: string;
  sender!: Sender;
  message!: string;
}
