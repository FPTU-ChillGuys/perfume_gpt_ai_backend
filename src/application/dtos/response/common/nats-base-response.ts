import { ApiProperty } from '@nestjs/swagger';

/**
 * BaseResponse cho NATS communication với .NET backend.
 * .NET trả về `Payload` (PascalCase), sau JSON serialization thành `payload` (camelCase).
 */
export class NatsBaseResponse<T = undefined> {
  @ApiProperty({ description: 'Kết quả xử lý' })
  success!: boolean;

  @ApiProperty({ description: 'Thông báo', nullable: true, required: false })
  message?: string | null;

  @ApiProperty({ description: 'Danh sách lỗi', nullable: true, required: false })
  errors?: string[] | null;

  @ApiProperty({ description: 'Dữ liệu trả về', required: false })
  payload?: T;
}
