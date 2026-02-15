import { MailerService } from '@nestjs-modules/mailer';
import {
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { funcHandlerAsync } from '../utils/error-handler';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(to: string, subject: string, text: string) {
    return await funcHandlerAsync(
      async () => {
        await this.mailerService.sendMail({
          to,
          subject,
          text
        });
        console.log(`Email sent to ${to} with subject "${subject}"`);
        return { success: true, message: 'Email sent successfully' };
      },
      'Failed to send email',
      true
    );
  }
}
