import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ChatMessageRequest } from './chat-message.request';

/** DTO yêu cầu Chat */
export class ChatRequest {
  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại', format: 'uuid' })
  @IsString()
  id!: string;

  /** ID người dùng (tự động lấy từ token, không cần truyền) */
  @ApiProperty({ description: 'ID người dùng (tự động lấy từ token, không cần truyền)', format: 'uuid', required: true })
  @IsString()
  userId?: string;

  /** Danh sách tin nhắn */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: [ChatMessageRequest], required: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageRequest)
  messages: ChatMessageRequest[] = [];

  /** Chế độ nhân viên tư vấn tại quầy */
  @ApiProperty({ description: 'Chế độ nhân viên tư vấn tại quầy', required: false, default: false })
  @IsOptional()
  isStaff?: boolean;

  /** Client là Mobile App để Server tự động parse message JSON */
  @ApiProperty({ description: 'Client là Mobile App', required: false, default: false })
  @IsOptional()
  isMobile?: boolean;
}
