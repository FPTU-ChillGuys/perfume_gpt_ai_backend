import {
  Body,
  Controller,
  InternalServerErrorException,
  Post
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';
import {
  SendEmailRequestDto,
} from 'src/application/dtos/common/email.dto';
import { Public } from 'src/application/common/Metadata';
import { EmailService } from 'src/infrastructure/servicies/mail.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';

@Public()
@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Gửi email text cơ bản' })
  @ApiBody({ type: SendEmailRequestDto })
  @ApiBaseResponse(String)
  @ApiBadRequestResponse({ description: 'Dữ liệu request không hợp lệ' })
  @ApiInternalServerErrorResponse({ description: 'Không thể gửi email' })
  async sendEmail(
    @Body() body: SendEmailRequestDto
  ): Promise<BaseResponse<string>> {
    const result = await this.emailService.sendEmail(
      body.to,
      body.subject,
      body.text
    );

    if (!result.success) {
      throw new InternalServerErrorException(result.error); 
    }

    return Ok('Email sent successfully');
  }
}
