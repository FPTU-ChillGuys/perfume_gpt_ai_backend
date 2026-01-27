import { Module } from '@nestjs/common';
import { UnitOfWork } from '../repositories/unit-of-work';
import { RepositoryModule } from './repository.module';

@Module({
  imports: [RepositoryModule],
  providers: [UnitOfWork],
  exports: [UnitOfWork]
})
export class UnitOfWorkModule {}
