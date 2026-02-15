import { Module } from '@nestjs/common';
import { EmailService } from '../servicies/mail.service';

@Module({
  providers: [EmailService],
  exports: [EmailService]
})
export class EmailModule {}
