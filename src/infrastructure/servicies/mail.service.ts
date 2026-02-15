import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(to: string, subject: string, text: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        text
      });
      console.log(`Email sent to ${to} with subject "${subject}"`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
    }
  }
}
