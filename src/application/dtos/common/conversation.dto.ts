import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { MessageDto, MessageRequestDto } from './message.dto';
import { CommonResponse } from '../response/common/common.response';

/** DTO cuộc hội thoại (response) */
export class ConversationDto extends CommonResponse {
  /** ID người dùng sở hữu cuộc hội thoại */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid', required: false })
  userId?: string;

  /** Danh sách tin nhắn trong cuộc hội thoại */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: () => [MessageDto], required: false })
  messages?: MessageDto[];

  /** Đánh dấu response được xử lý cho Mobile */
  @ApiProperty({ description: 'Đánh dấu response cho Mobile', required: false })
  isMobile?: boolean;

  constructor(init?: Partial<ConversationDto>) {
    super();
    Object.assign(this, init);
  }
}

/** DTO cuộc hội thoại (request) */
export class ConversationRequestDto {
  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại', format: 'uuid' })
  @IsString()
  id!: string;

  /** ID người dùng (tự động lấy từ JWT token, không cần truyền) */
  @ApiProperty({ description: 'ID người dùng (tự động lấy từ token, không cần truyền)', format: 'uuid', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  /** Danh sách tin nhắn */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: () => [MessageRequestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageRequestDto)
  messages!: MessageRequestDto[];

  /** Chế độ nhân viên tư vấn tại quầy */
  @ApiProperty({ description: 'Chế độ nhân viên tư vấn tại quầy', required: false })
  @IsOptional()
  isStaff?: boolean;

  /** Client là Mobile App để Server tự động parse message JSON */
  @ApiProperty({ description: 'Client là Mobile App', required: false })
  @IsOptional()
  isMobile?: boolean;

  constructor(init?: Partial<ConversationRequestDto>) {
    Object.assign(this, init);
  }
}


/** DTO cuộc hội thoại (request) */
export class ConversationRequestDtoV2 {
  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại', format: 'uuid' })
  @IsString()
  id!: string;

  /** Danh sách tin nhắn */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: () => [MessageRequestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageRequestDto)
  messages!: MessageRequestDto[];

  constructor(init?: Partial<ConversationRequestDtoV2>) {
    Object.assign(this, init);
  }
}

/** Convert từ stringify sang MessageRequestDto */
export function convertStringifyToMessageRequestDto(messages: string): ConversationRequestDtoV2 {
  let result: any = messages

  // Nếu là chuỗi JSON chứa chuỗi JSON, parse lần đầu
  if (typeof result === 'string' && result.trim().startsWith('"')) {
    result = JSON.parse(result)
  }

  // Lần parse thứ 2 để ra object
  const obj = JSON.parse(result)
  return obj as ConversationRequestDtoV2
}
