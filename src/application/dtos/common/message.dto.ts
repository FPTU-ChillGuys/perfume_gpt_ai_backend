import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from '../response/common/common.response';
import { Sender } from 'src/domain/enum/sender.enum';

/** DTO tin nhắn (response) */
export class MessageDto extends CommonResponse {
  /** Người gửi tin nhắn */
  @ApiProperty({ description: 'Người gửi tin nhắn (user hoặc assistant)' })
  sender!: string;

  /** Nội dung tin nhắn */
  @ApiProperty({ description: 'Nội dung tin nhắn' })
  message!: string;

  constructor(init?: Partial<MessageDto>) {
    super();
    Object.assign(this, init);
  }
}

/** DTO tin nhắn (request) */
export class MessageRequestDto {
  /** Người gửi tin nhắn */
  @ApiProperty({ description: 'Người gửi tin nhắn', enum: Sender })
  sender!: Sender;

  /** Nội dung tin nhắn */
  @ApiProperty({ description: 'Nội dung tin nhắn' })
  message!: string;

  constructor(init?: Partial<MessageRequestDto>) {
    Object.assign(this, init);
  }
}
