import { Module } from '@nestjs/common';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RestockService],
  exports: [RestockService]
})
export class RestockModule { }
