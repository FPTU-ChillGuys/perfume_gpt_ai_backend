import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ChatMessageRequest } from './chat-message.request';

/** DTO yêu cầu Chat */
export class ChatRequest {
  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại', format: 'uuid' })
  @IsString()
  id: string;

  /** ID người dùng (tự động lấy từ token, không cần truyền) */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  /** Danh sách tin nhắn */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: [ChatMessageRequest] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageRequest)
  messages: ChatMessageRequest[];

  /** Chế độ nhân viên tư vấn tại quầy */
  @ApiProperty({ description: 'Chế độ nhân viên tư vấn tại quầy', required: false })
  @IsOptional()
  isStaff?: boolean;
}
