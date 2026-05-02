import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemRequest {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  quantity: number;
}
