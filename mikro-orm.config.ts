import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

export default defineConfig({
  entities: ['./src/domain/entities/**/*.ts'],
  extensions: [EntityGenerator, Migrator],
  metadataProvider: TsMorphMetadataProvider,
  dbName: 'perfume_gpt_ai',
  user: 'vqn',
  password: '1234567890',
  host: 'localhost',
  port: 5432
});
