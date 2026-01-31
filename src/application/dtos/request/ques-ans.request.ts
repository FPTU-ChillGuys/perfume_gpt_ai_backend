import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { QuestAnsDetailRequest } from './ques-ans-detail.request';

@ApiSchema()
export class QuesAnwsRequest {
  @ApiProperty()
  userId!: string;
  
  @ApiProperty()
  details = new Array<QuestAnsDetailRequest>();

  constructor(init?: Partial<QuesAnwsRequest>) {
    Object.assign(this, init);
  }
}
