import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';

export default defineConfig({
  driver: PostgreSqlDriver,
  entities: [AdminInstruction],
  extensions: [EntityGenerator, Migrator],
  metadataProvider: TsMorphMetadataProvider,
  dbName: 'perfume_gpt_ai',
  user: 'vqn',
  password: '1234567890',
  host: 'localhost',
  port: 5432,
  dynamicImportProvider: (id) => import(id)
});
