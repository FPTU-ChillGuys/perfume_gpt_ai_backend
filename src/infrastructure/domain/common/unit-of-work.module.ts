import { Module } from '@nestjs/common';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { RepositoryModule } from 'src/infrastructure/domain/common/repository.module';

@Module({
  imports: [RepositoryModule],
  providers: [UnitOfWork],
  exports: [UnitOfWork]
})
export class UnitOfWorkModule {}
