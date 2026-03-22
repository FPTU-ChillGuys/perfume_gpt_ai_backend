import { Module } from '@nestjs/common';
import { EmailController } from 'src/api/controllers/email.controller';
import { EmailService } from '../servicies/mail.service';
import { RestockReportEmailService } from '../servicies/restock-report-email.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, RestockReportEmailService],
  exports: [EmailService, RestockReportEmailService]
})
export class EmailModule {}
