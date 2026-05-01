import { Module } from '@nestjs/common';
import { EmailService } from 'src/infrastructure/domain/common/mail.service';
import { RestockReportEmailService } from 'src/infrastructure/domain/restock/restock-report-email.service';
@Module({
  controllers: [],
  imports: [],
  providers: [EmailService, RestockReportEmailService],
  exports: [EmailService, RestockReportEmailService]
})
export class EmailModule { }
