import { RequestType } from 'src/domain/enum/request-type.enum';

export class AddPromptRequest {
  userId!: string;
  requestType!: RequestType;
  prompt!: string;
}
