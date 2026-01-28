import { ApiProperty } from '@nestjs/swagger';

export class UpdateResRequest {
  @ApiProperty()
  response!: string;
}
