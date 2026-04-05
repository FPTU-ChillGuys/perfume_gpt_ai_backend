import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { entities } from 'src/infrastructure/domain/utils/entities';

@Module({
  imports: [MikroOrmModule.forFeature([...entities])],
  exports: [MikroOrmModule]
})
export class RepositoryModule {}
