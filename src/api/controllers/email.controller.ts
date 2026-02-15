import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { EmailService } from 'src/infrastructure/servicies/mail.service';

@Public()
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  sendEmail(@Body() body: { to: string; subject: string; text: string }) {
    this.emailService.sendEmail(body.to, body.subject, body.text);
  }
}
