import { Module } from '@nestjs/common';
import { UnitOfWork } from '../repositories/unit-of-work';
import { RepositoryModule } from './repository.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
  imports: [RepositoryModule, MikroOrmModule],
  providers: [UnitOfWork],
  exports: [UnitOfWork]
})
export class UnitOfWorkModule {}
