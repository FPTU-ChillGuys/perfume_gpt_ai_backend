import { Module } from '@nestjs/common';
import { EmailService } from 'src/infrastructure/domain/common/mail.service';
import { RestockReportEmailService } from 'src/infrastructure/domain/restock/restock-report-email.service';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  controllers: [],
  imports: [ProviderModule],
  providers: [EmailService, RestockReportEmailService],
  exports: [EmailService, RestockReportEmailService]
})
export class EmailModule { }
