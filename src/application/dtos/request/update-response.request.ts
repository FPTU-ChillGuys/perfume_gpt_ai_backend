import { ApiProperty } from '@nestjs/swagger';

/** Request cập nhật nội dung phản hồi */
export class UpdateResRequest {
  /** Nội dung phản hồi mới */
  @ApiProperty({ description: 'Nội dung phản hồi cần cập nhật' })
  response!: string;

  constructor(init?: Partial<UpdateResRequest>) {
    Object.assign(this, init);
  }
}
