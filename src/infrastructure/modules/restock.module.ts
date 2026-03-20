import { Module } from '@nestjs/common';
import { RestockService } from '../servicies/restock.service';

@Module({
  providers: [RestockService],
  exports: [RestockService]
})
export class RestockModule {}
