import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TestingModule, Test } from '@nestjs/testing';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { entities } from 'src/infrastructure/utils/entities';
import { UnitOfWork } from 'src/infrastructure/repositories/unit-of-work';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Loads host config for DB connection by reading host-config.mjs with fs.
 * Dynamic import of .mjs doesn't work under ts-jest, so we parse the file directly.
 */
function loadHostConfig(): { host: string; port: number; user: string; password: string } {
  try {
    const configPath = path.join(process.cwd(), 'host-config.mjs');
    const content = fs.readFileSync(configPath, 'utf-8');
    // Extract the object literal from: export const host_config = { ... };
    const match = content.match(/host_config\s*=\s*(\{[\s\S]*?\})/);
    if (match) {
      // Safe eval of a plain object literal
      const config = new Function(`return ${match[1]}`)();
      return config;
    }
  } catch (e) {
    console.warn('⚠ Could not load host-config.mjs, using fallback:', (e as Error).message);
  }
  return { host: 'localhost', port: 5432, user: 'postgres', password: 'password' };
}

/**
 * Creates a NestJS testing module with MikroORM using PostgreSQL test database.
 * Uses a real `perfume_gpt_ai_test` database — same driver as production.
 *
 * @param additionalProviders Services under test + any mocks
 */
export async function createIntegrationTestingModule(
  additionalProviders: any[] = [],
): Promise<TestingModule> {
  const config = loadHostConfig();

  const testModule = await Test.createTestingModule({
    imports: [
      MikroOrmModule.forRoot({
        driver: PostgreSqlDriver,
        dbName: 'perfume_gpt_ai_test',
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        entities: [...entities],
        allowGlobalContext: true,
        debug: false,
      }),
      MikroOrmModule.forFeature([...entities]),
    ],
    providers: [UnitOfWork, ...additionalProviders],
  }).compile();

  const orm = testModule.get(MikroORM);

  // Tạo schema từ đầu cho test DB (drop all → create all)
  await orm.schema.refreshDatabase();

  return testModule;
}

/**
 * Clears all data from the database between tests.
 * Keeps the schema intact — only removes rows.
 */
export async function clearDatabase(orm: MikroORM): Promise<void> {
  const connection = orm.em.getConnection();

  // Lấy danh sách bảng, dùng TRUNCATE ... CASCADE cho PostgreSQL
  const allMeta = orm.getMetadata().getAll();
  const tableNames: string[] = [];
  for (const name of Object.keys(allMeta)) {
    const meta = allMeta[name];
    if (meta.tableName && !meta.abstract) {
      tableNames.push(`"${meta.tableName}"`);
    }
  }

  if (tableNames.length > 0) {
    await connection.execute(`TRUNCATE TABLE ${tableNames.join(', ')} CASCADE`);
  }

  orm.em.clear();
}
