import { RequestType } from 'src/domain/enum/request-type.enum';
import { CommonResponse } from './common.response';

export class AIReqResResponse extends CommonResponse {
  userId!: string;
  requestType!: RequestType;
  prompt!: string;
  response!: string;
}
