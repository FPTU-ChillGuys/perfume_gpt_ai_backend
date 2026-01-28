import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseAPI<T = undefined> {
  @ApiProperty()
  success!: boolean;
  @ApiProperty()
  error?: string | null;
  @ApiProperty()
  payload?: T;
}
