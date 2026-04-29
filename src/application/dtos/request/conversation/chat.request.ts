import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ChatMessageRequest } from './chat-message.request';

export class ChatRequest {
  @ApiProperty({ description: 'ID cuộc hội thoại', format: 'uuid' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'ID người dùng (optional — tự động lấy từ JWT token nếu không truyền)', format: 'uuid', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Danh sách tin nhắn', type: [ChatMessageRequest], required: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageRequest)
  messages: ChatMessageRequest[] = [];

  @ApiProperty({ description: 'Chế độ nhân viên tư vấn tại quầy', required: false, default: false })
  @IsOptional()
  isStaff?: boolean;

  @ApiProperty({ description: 'Client là Mobile App', required: false, default: false })
  @IsOptional()
  isMobile?: boolean;
}
