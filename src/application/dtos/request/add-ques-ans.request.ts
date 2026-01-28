import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema()
export class AddQuesAnwsRequest {
  @ApiProperty()
  userId!: string;
  @ApiProperty()
  questionId!: string;
  @ApiProperty()
  answerId!: string;
}
