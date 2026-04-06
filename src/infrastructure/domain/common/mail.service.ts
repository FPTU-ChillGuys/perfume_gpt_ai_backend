import { MailerService } from '@nestjs-modules/mailer';
import {
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';

export interface ProductVariant {
  id: string;
  sku: string;
  volumeMl: number;
  type: string;
  basePrice: number;
  status: string;
  concentrationName: string;
}

export interface EmailProduct {
  id: string;
  name: string;
  description: string;
  brandName: string;
  categoryName: string;
  primaryImage?: string;
  variants?: ProductVariant[];
  aiAcceptanceId?: string;
}

export interface EmailTemplateData {
  userName: string;
  frontendUrl: string;
  message?: string;
  heading?: string;
  recommendation?: string;
  repurchaseAdvice?: string;
  products?: EmailProduct[];
  savingsPercent?: string;
  aiInsight?: string;
  [key: string]: any;
}

export enum EmailTemplate {
  RECOMMENDATION = 'recommendation',
  REPURCHASE = 'repurchase',
  RESTOCK_CRITICAL_REPORT = 'restock-critical-report'
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Gửi email bằng template
   * @param to Email người nhận
   * @param subject Tiêu đề email
   * @param template Template name (nằm trong src/infrastructure/templates/emails/)
   * @param context Data để fill vào template
   */
  async sendTemplateEmail(
    to: string,
    subject: string,
    template: EmailTemplate | string,
    context: EmailTemplateData
  ) {
    return await funcHandlerAsync(
      async () => {
        await this.mailerService.sendMail({
          to,
          subject,
          template,
          context
        });
        this.logger.log(
          `Email sent to ${to} with subject "${subject}" using template "${template}"`
        );
        return { success: true, message: 'Email sent successfully' };
      },
      'Failed to send template email',
      true
    );
  }

  /**
   * Gửi email đơn giản (plain text/html)
   * @deprecated Dùng sendTemplateEmail thay vì
   */
  async sendEmail(to: string, subject: string, text: string) {
    return await funcHandlerAsync(
      async () => {
        await this.mailerService.sendMail({
          to,
          subject,
          text
        });
        this.logger.log(`Email sent to ${to} with subject "${subject}"`);
        return { success: true, message: 'Email sent successfully' };
      },
      'Failed to send email',
      true
    );
  }
}
