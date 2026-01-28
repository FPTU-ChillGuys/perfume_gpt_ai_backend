import { ApiProperty } from '@nestjs/swagger';
import { RequestType } from 'src/domain/enum/request-type.enum';

export class AddPromptRequest {
  @ApiProperty()
  userId!: string;
  @ApiProperty({ enum: RequestType })
  requestType!: RequestType;
  @ApiProperty()
  prompt!: string;
}
