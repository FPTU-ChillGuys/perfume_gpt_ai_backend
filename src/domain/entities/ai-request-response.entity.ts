import { RequestType } from '../enum/request-type.enum';
import { Common } from './common/common.entities';

export class AIRequestResponse extends Common {
  userId!: string;
  requestType!: RequestType;
  prompt!: string;
  response!: string;
}
