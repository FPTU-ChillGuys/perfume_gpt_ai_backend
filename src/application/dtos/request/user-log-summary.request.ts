import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

/** Request tạo bản tóm tắt log người dùng */
export class UserLogSummaryRequest {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @IsUUID()
  userId: string;

  /** Ngày bắt đầu */
  @ApiProperty({ description: 'Ngày bắt đầu khoảng thời gian' })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  /** Ngày kết thúc */
  @ApiProperty({ description: 'Ngày kết thúc khoảng thời gian' })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  /** Nội dung tóm tắt */
  @ApiProperty({ description: 'Nội dung tóm tắt log', default: '' })
  @IsOptional()
  @IsString()
  logSummary: string = '';
}