import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from '../response/common/common.response';
import { ConversationOutputDto } from './conversation-output.dto';
import { IsEnum, IsNotEmpty, IsObject, IsString, ValidateIf } from 'class-validator';
import { Sender } from 'src/domain/enum/sender.enum';

/** DTO tin nhắn (response) */
export class MessageDto extends CommonResponse {
  /** Người gửi tin nhắn */
  @ApiProperty({ description: 'Người gửi tin nhắn (user hoặc assistant)' })
  sender!: string;

  /** Nội dung tin nhắn */
  @ApiProperty({ 
    description: 'Nội dung tin nhắn (chuỗi hoặc object cho assistant)',
    oneOf: [
      { type: 'string' },
      { $ref: '#/components/schemas/ConversationOutputDto' }
    ]
  })
  message!: string | ConversationOutputDto;

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
  @ApiProperty({ 
    description: 'Nội dung tin nhắn',
    oneOf: [
      { type: 'string' },
      { $ref: '#/components/schemas/ConversationOutputDto' }
    ]
  })
  @ValidateIf(o => typeof o.message !== 'string')
  @IsObject()
  @ValidateIf(o => typeof o.message === 'string')
  @IsString()
  @IsNotEmpty()
  message!: string | ConversationOutputDto;

  constructor(init?: Partial<MessageRequestDto>) {
    Object.assign(this, init);
  }
}
