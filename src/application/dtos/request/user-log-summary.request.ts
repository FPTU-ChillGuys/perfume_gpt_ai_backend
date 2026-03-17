import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/** Request tạo bản tóm tắt log người dùng */
export class UserLogSummaryRequest {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @IsUUID()
  userId: string;

  /** Ngày bắt đầu (legacy, không còn dùng để tổng hợp) */
  @ApiProperty({ description: 'Ngày bắt đầu (legacy)', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  /** Ngày kết thúc (legacy, không còn dùng để tổng hợp) */
  @ApiProperty({ description: 'Ngày kết thúc (legacy)', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  /** Nội dung tóm tắt */
  @ApiProperty({ description: 'Nội dung tóm tắt log', default: '' })
  @IsOptional()
  @IsString()
  logSummary: string = '';

  /** Snapshot feature dạng JSON */
  @ApiProperty({ description: 'Feature snapshot dạng JSON', required: false, type: Object })
  @IsOptional()
  @IsObject()
  featureSnapshot?: Record<string, unknown>;

  /** Bản tóm tắt log theo ngày */
  @ApiProperty({ description: 'Bản tóm tắt log theo ngày', required: false, type: Object })
  @IsOptional()
  @IsObject()
  dailyLogSummary?: Record<string, string>;

  /** Snapshot feature theo ngày */
  @ApiProperty({ description: 'Feature snapshot theo ngày', required: false, type: Object })
  @IsOptional()
  @IsObject()
  dailyFeatureSnapshot?: Record<string, unknown>;

}