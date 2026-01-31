import { ApiProperty } from '@nestjs/swagger';

export class UpdateResRequest {
  @ApiProperty()
  response!: string;

  constructor(init?: Partial<UpdateResRequest>) {
    Object.assign(this, init);
  }
}
