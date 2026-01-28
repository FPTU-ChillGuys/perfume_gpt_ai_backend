import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { entities } from 'src/infrastructure/utils/entities';

export const 

export default defineConfig({
  driver: PostgreSqlDriver,
  entities: [...entities],
  extensions: [EntityGenerator, Migrator],
  metadataProvider: TsMorphMetadataProvider,
  dbName: 'perfume_gpt_ai',
  // user: process.env.POSTGRES_USER || '',
  // password: process.env.POSTGRES_PASSWORD || '',
  dynamicImportProvider: (id) => import(id)
});
