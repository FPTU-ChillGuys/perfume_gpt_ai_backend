import { Module } from '@nestjs/common';
import { EmailController } from 'src/api/controllers/email.controller';
import { EmailService } from 'src/infrastructure/domain/common/mail.service';
import { RestockReportEmailService } from 'src/infrastructure/domain/restock/restock-report-email.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, RestockReportEmailService],
  exports: [EmailService, RestockReportEmailService]
})
export class EmailModule {}
