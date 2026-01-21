import { Sender } from 'src/domain/enum/sender.enum';

export class AddMessageRequest {
  sender!: Sender;
  message!: string;
}
