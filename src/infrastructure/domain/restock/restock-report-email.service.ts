import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EmailService,
  EmailTemplate
} from 'src/infrastructure/domain/common/mail.service';

type CriticalRestockEmailItem = {
  product: string;
  sku: string;
  stock: number;
  threshold: number;
  issue: string;
};

@Injectable()
export class RestockReportEmailService {
  private readonly logger = new Logger(RestockReportEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  private isCriticalStock(
    totalQuantity: number,
    lowStockThreshold: number
  ): boolean {
    const criticalThreshold = Math.max(1, Math.floor(lowStockThreshold * 0.5));
    return totalQuantity === 0 || totalQuantity <= criticalThreshold;
  }

  private async resolveStaffRecipients(): Promise<string[]> {
    const staffUsers = await this.prisma.aspNetUsers.findMany({
      where: {
        IsActive: true,
        IsDeleted: false,
        Email: { not: null },
        AspNetUserRoles: {
          some: {
            AspNetRoles: {
              OR: [
                { NormalizedName: 'STAFF' },
                { NormalizedName: 'ADMIN' },
                { Name: { contains: 'staff' } },
                { Name: { contains: 'Staff' } },
                { Name: { contains: 'admin' } },
                { Name: { contains: 'Admin' } }
              ]
            }
          }
        }
      },
      select: {
        Email: true
      }
    });

    const emails = staffUsers
      .map((user) => user.Email?.trim().toLowerCase() ?? '')
      .filter((email) => email.length > 0);

    return Array.from(new Set(emails));
  }

  async sendDailyCriticalRestockReport(): Promise<{
    sent: boolean;
    recipientCount: number;
    criticalCount: number;
  }> {
    const generatedAtDate = new Date();
    const reportDate = generatedAtDate.toISOString().slice(0, 10);

    const lowStockItems = await this.prisma.stocks.findMany({
      where: {
        ProductVariants: {
          IsDeleted: false,
          Products: { IsDeleted: false }
        },
        TotalQuantity: { lte: this.prisma.stocks.fields.LowStockThreshold }
      },
      include: {
        ProductVariants: {
          include: {
            Products: true,
            Concentrations: true
          }
        }
      }
    });

    const criticalItems = lowStockItems.filter((stock) =>
      this.isCriticalStock(stock.TotalQuantity, stock.LowStockThreshold)
    );

    if (criticalItems.length === 0) {
      this.logger.log(
        `[DailyCriticalRestockReport] Skip sending - no critical items on ${reportDate}`
      );
      return { sent: false, recipientCount: 0, criticalCount: 0 };
    }

    const recipients = await this.resolveStaffRecipients();
    if (recipients.length === 0) {
      this.logger.warn(
        '[DailyCriticalRestockReport] No staff recipients found. Report email skipped.'
      );
      return {
        sent: false,
        recipientCount: 0,
        criticalCount: criticalItems.length
      };
    }

    const items: CriticalRestockEmailItem[] = criticalItems
      .map((stock) => {
        const concentrationName =
          stock.ProductVariants.Concentrations?.Name?.trim();
        const productBase = stock.ProductVariants.Products.Name;
        const volumeMl = stock.ProductVariants.VolumeMl;
        const product = concentrationName
          ? `${productBase} ${volumeMl}ml ${concentrationName}`
          : `${productBase} ${volumeMl}ml`;

        return {
          product,
          sku: stock.ProductVariants.Sku,
          stock: stock.TotalQuantity,
          threshold: stock.LowStockThreshold,
          issue:
            stock.TotalQuantity === 0
              ? 'Out of stock'
              : 'At or below 50% of low-stock threshold'
        };
      })
      .sort((a, b) => a.stock - b.stock);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '#';
    const generatedAt = generatedAtDate.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh'
    });
    const subject = `[Critical Restock] ${items.length} SKU(s) need attention - ${reportDate}`;

    const sendResults = await Promise.allSettled(
      recipients.map((recipient) =>
        this.emailService.sendTemplateEmail(
          recipient,
          subject,
          EmailTemplate.RESTOCK_CRITICAL_REPORT,
          {
            userName: 'Staff Team',
            generatedAt,
            criticalCount: items.length,
            items,
            frontendUrl
          }
        )
      )
    );

    const successCount = sendResults.filter(
      (result) => result.status === 'fulfilled'
    ).length;
    const failCount = sendResults.length - successCount;

    if (failCount > 0) {
      this.logger.warn(
        `[DailyCriticalRestockReport] Partial send: ${successCount}/${recipients.length} recipients`
      );
    } else {
      this.logger.log(
        `[DailyCriticalRestockReport] Sent to ${successCount} staff recipient(s), critical SKU count: ${items.length}`
      );
    }

    return {
      sent: successCount > 0,
      recipientCount: successCount,
      criticalCount: items.length
    };
  }

  @Cron('0 0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyCriticalRestockReport(): Promise<void> {
    this.logger.log('[DailyCriticalRestockReport] Cron job started');
    try {
      await this.sendDailyCriticalRestockReport();
      this.logger.log('[DailyCriticalRestockReport] Cron job finished');
    } catch (error) {
      this.logger.error('[DailyCriticalRestockReport] Cron job failed', error);
    }
  }
}
