import { ApiProperty } from '@nestjs/swagger';

/** Response chuẩn cho API bên ngoài (dùng trường `payload`) */
export class BaseResponseAPI<T = undefined> {
  /** Kết quả xử lý thành công hay thất bại */
  @ApiProperty({ description: 'Kết quả xử lý' })
  success!: boolean;

  /** Thông báo lỗi (nếu có) */
  @ApiProperty({ description: 'Thông báo lỗi', nullable: true, required: false })
  error?: string | null;

  /** Dữ liệu trả về */
  @ApiProperty({ description: 'Dữ liệu trả về', required: false })
  payload?: T;
}
