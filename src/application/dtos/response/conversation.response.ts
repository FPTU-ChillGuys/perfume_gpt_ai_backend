import { CommonResponse } from './common/common.response';
import { MessageResponse } from './message.response';

export class ConversationResponse extends CommonResponse {
  userId!: string;
  messages!: MessageResponse[];

  constructor(init?: Partial<ConversationResponse>) {
    super();
    Object.assign(this, init);
  }
}
