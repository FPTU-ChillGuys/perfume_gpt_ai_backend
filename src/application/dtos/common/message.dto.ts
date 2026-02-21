import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
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
  @IsEnum(Sender)
  sender!: Sender;

  /** Nội dung tin nhắn */
  @ApiProperty({ description: 'Nội dung tin nhắn' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  constructor(init?: Partial<MessageRequestDto>) {
    Object.assign(this, init);
  }
}
