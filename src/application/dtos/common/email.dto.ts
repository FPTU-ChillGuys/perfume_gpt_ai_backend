import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendEmailRequestDto {
  @ApiProperty({ description: 'Email người nhận', example: 'user@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ description: 'Tiêu đề email', example: 'Welcome to PerfumeGPT' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Nội dung email dạng text', example: 'Xin chào bạn!' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class SendEmailResponseDto {
  @ApiProperty({ description: 'Trạng thái gửi email', example: true })
  success!: boolean;

  @ApiProperty({ description: 'Thông báo kết quả', example: 'Email sent successfully' })
  message!: string;
}
