import { Module } from '@nestjs/common';
import { EmailController } from 'src/api/controllers/email.controller';
import { EmailService } from '../servicies/mail.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService]
})
export class EmailModule {}
