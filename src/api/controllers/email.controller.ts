import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';
import { SendEmailRequestDto, SendEmailResponseDto } from 'src/application/dtos/common/email.dto';
import { Public } from 'src/application/common/Metadata';
import { EmailService } from 'src/infrastructure/servicies/mail.service';

@Public()
@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Gửi email text cơ bản' })
  @ApiBody({ type: SendEmailRequestDto })
  @ApiOkResponse({
    description: 'Gửi email thành công',
    type: SendEmailResponseDto
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu request không hợp lệ' })
  @ApiInternalServerErrorResponse({ description: 'Không thể gửi email' })
  async sendEmail(@Body() body: SendEmailRequestDto): Promise<SendEmailResponseDto> {
    await this.emailService.sendEmail(body.to, body.subject, body.text);

    return {
      success: true,
      message: 'Email sent successfully'
    };
  }
}
