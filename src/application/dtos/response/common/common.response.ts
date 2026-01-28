import { ApiProperty } from '@nestjs/swagger';

export class CommonResponse {
  @ApiProperty()
  id?: string = '';
  @ApiProperty()
  createdAt?: Date = new Date();
  @ApiProperty()
  updatedAt?: Date = new Date();
}
