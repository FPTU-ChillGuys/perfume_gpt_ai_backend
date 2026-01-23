import { Entity } from '@mikro-orm/core';
import { RequestType } from '../enum/request-type.enum';
import { Common } from './common/common.entities';
import { AIRequestResponseRepository } from 'src/infrastructure/repositories/ai-request-response.repository';

@Entity({ repository: () => AIRequestResponseRepository })
export class AIRequestResponse extends Common {
  userId!: string;
  requestType!: RequestType;
  prompt!: string;
  response!: string;
}
