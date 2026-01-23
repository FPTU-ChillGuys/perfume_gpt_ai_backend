import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  entitiesTs: ['src/domain/entities'],
  entities: ['dist/domain/entities'],
  extensions: [EntityGenerator, Migrator],
  dbName: 'perfume_gpt_ai'
});
