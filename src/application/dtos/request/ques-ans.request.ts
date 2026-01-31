import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { QuestAnsDetailRequest } from './ques-ans-detail.request';

@ApiSchema()
export class AddQuesAnwsRequest {
  @ApiProperty()
  userId!: string;
  
  @ApiProperty()
  details = new Array<QuestAnsDetailRequest>();

  constructor(init?: Partial<AddQuesAnwsRequest>) {
    Object.assign(this, init);
  }
}
