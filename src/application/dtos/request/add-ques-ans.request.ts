import { ApiSchema } from '@nestjs/swagger';

@ApiSchema()
export class AddQuesAnwsRequest {
  userId!: string;
  questionId!: string;
  answerId!: string;
}
