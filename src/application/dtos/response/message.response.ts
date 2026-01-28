import { Sender } from 'src/domain/enum/sender.enum';
import { CommonResponse } from './common/common.response';

export class MessageResponse extends CommonResponse {
  sender!: Sender;
  message!: string;

  constructor(init?: Partial<MessageResponse>) {
    super();
    Object.assign(this, init);
  }
}
