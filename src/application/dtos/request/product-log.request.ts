import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ProductViewLogRequest {
  @ApiProperty({
    description:
      'UUID của user cần gắn log (optional, dùng khi request không có Bearer token)',
    required: false,
    nullable: true,
    format: 'uuid'
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'UUID của sản phẩm', format: 'uuid' })
  @IsString()
  productId!: string;

  @ApiProperty({
    description:
      'UUID của variant (nếu người dùng click vào một variant cụ thể)',
    required: false,
    nullable: true,
    format: 'uuid'
  })
  @IsOptional()
  @IsString()
  variantId?: string;
}

export class SearchTextLogRequest {
  @ApiProperty({
    description:
      'UUID của user cần gắn log (optional, dùng khi request không có Bearer token)',
    required: false,
    nullable: true,
    format: 'uuid'
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Từ khóa tìm kiếm cần ghi log' })
  @IsString()
  searchText!: string;
}
