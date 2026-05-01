import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

/** Request cơ sở cho phân trang và sắp xếp */
export class PagedAndSortedRequest {
  /** Số trang (bắt đầu từ 1) */
  @ApiProperty({ description: 'Số trang', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  PageNumber: number = 1;

  /** Số bản ghi mỗi trang */
  @ApiProperty({ description: 'Số bản ghi mỗi trang', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  PageSize: number = 10;

  // /** Trường sắp xếp */
  // @ApiProperty({ description: 'Tên trường sắp xếp', default: '' })
  // @IsOptional()
  // @IsString()
  // SortBy: string = '';

  /** Thứ tự sắp xếp */
  @ApiProperty({
    description: 'Thứ tự sắp xếp',
    enum: ['asc', 'desc'],
    default: 'asc'
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  SortOrder: 'asc' | 'desc' = 'asc';

  /** Sắp xếp giảm dần hay không */
  @ApiProperty({ description: 'Sắp xếp giảm dần', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  IsDescending: boolean = false;
}
