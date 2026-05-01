import { MailerService } from '@nestjs-modules/mailer';
import {
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';

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

  constructor(
    private readonly mailerService: MailerService,
    private readonly err: I18nErrorHandler
  ) {}

  async sendTemplateEmail(
    to: string,
    subject: string,
    template: EmailTemplate | string,
    context: EmailTemplateData
  ) {
    return await this.err.wrap(async () => {
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
    }, 'errors.mail.send_template');
  }

  async sendEmail(to: string, subject: string, text: string) {
    return await this.err.wrap(async () => {
      await this.mailerService.sendMail({
        to,
        subject,
        text
      });
      this.logger.log(`Email sent to ${to} with subject "${subject}"`);
      return { success: true, message: 'Email sent successfully' };
    }, 'errors.mail.send');
  }
}
