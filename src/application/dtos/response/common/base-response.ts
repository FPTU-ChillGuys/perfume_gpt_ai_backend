import { ApiProperty } from "@nestjs/swagger";

export class BaseResponse<T = undefined> {
  @ApiProperty()
  success!: boolean;
  @ApiProperty()
  error?: string | null;
  @ApiProperty()
  data?: T;
}
