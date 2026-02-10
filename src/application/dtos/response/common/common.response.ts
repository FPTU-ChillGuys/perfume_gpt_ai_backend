import { ApiProperty } from '@nestjs/swagger';

/** Response cơ sở chứa các trường dùng chung */
export class CommonResponse {
  /** ID bản ghi */
  @ApiProperty({ description: 'ID bản ghi', format: 'uuid' })
  id?: string = '';

  /** Ngày tạo */
  @ApiProperty({ description: 'Ngày tạo' })
  createdAt?: Date = new Date();

  /** Ngày cập nhật gần nhất */
  @ApiProperty({ description: 'Ngày cập nhật gần nhất' })
  updatedAt?: Date = new Date();
}
