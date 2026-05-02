import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import * as fs from 'fs';
import * as path from 'path';
import { entities } from 'src/infrastructure/domain/utils/entities';
import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { ADMIN_INSTRUCTION_SEED_DATA } from './admin-instruction-seed-data';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';

function readHostConfig(): {
  host: string;
  port: number;
  user: string;
  password: string;
} {
  const configPath = path.resolve(process.cwd(), 'host-config.mjs');
  const content = fs.readFileSync(configPath, 'utf-8');

  // Regex chung hỗ trợ tất cả key
  const extract = (key: string): string => {
    const re = new RegExp(`${key}\\s*:\\s*['"]?([^'",}\\n]+)['"]?`);
    const match = content.match(re);

    if (!match) {
      throw new Error(
        `[Sync Prompts] Không tìm thấy "${key}" trong host-config.mjs`
      );
    }

    return match[1].trim();
  };

  return {
    host: extract('host'),
    port: Number(extract('port')),
    user: extract('user'),
    password: extract('password')
  };
}

async function buildOrmConfig() {
  const host_config = readHostConfig();

  return {
    driver: PostgreSqlDriver,
    entities: [...entities],
    extensions: [EntityGenerator, Migrator],
    metadataProvider: TsMorphMetadataProvider,
    dbName: 'perfume_gpt_ai',
    dynamicImportProvider: (id: string) => import(id),
    host: host_config.host,
    port: host_config.port,
    user: host_config.user,
    password: host_config.password,
    migrations: {
      path: './dist/migrations',
      pathTs: './src/migrations'
    },
    allowGlobalContext: true
  };
}

async function syncPrompts() {
  console.log('\n🔄 [Sync Prompts] Đang kết nối database...');

  const config = await buildOrmConfig();
  const orm = await MikroORM.init(config);
  const em = orm.em.fork();

  try {
    // Kiểm tra bảng tồn tại
    try {
      await em.count(AdminInstruction);
    } catch {
      console.error(
        '❌ [Sync Prompts] Bảng admin_instruction chưa tồn tại.\n' +
          '   Hãy chạy migration trước: npx mikro-orm migration:up'
      );
      process.exit(1);
    }

    console.log(
      `📋 [Sync Prompts] Tìm thấy ${ADMIN_INSTRUCTION_SEED_DATA.length} prompt(s) cần đồng bộ.\n`
    );

    let updatedCount = 0;
    let createdCount = 0;

    for (const item of ADMIN_INSTRUCTION_SEED_DATA) {
      const existing = await em.findOne(AdminInstruction, {
        instructionType: item.instructionType
      });

      if (existing) {
        if (existing.instruction === item.instruction) {
          console.log(
            `  ⚪ "${item.instructionType}" — không thay đổi, bỏ qua.`
          );
        } else {
          existing.instruction = item.instruction;
          em.persist(existing);
          console.log(`  ✅ "${item.instructionType}" — đã cập nhật.`);
          updatedCount++;
        }
      } else {
        const newInstruction = new AdminInstruction({
          instruction: item.instruction,
          instructionType: item.instructionType
        });
        em.persist(newInstruction);
        console.log(`  ➕ "${item.instructionType}" — đã tạo mới.`);
        createdCount++;
      }
    }

    await em.flush();

    console.log('\n────────────────────────────────────────');
    console.log(`✅ Đồng bộ hoàn tất:`);
    console.log(`   • Cập nhật: ${updatedCount} domain(s)`);
    console.log(`   • Tạo mới:  ${createdCount} domain(s)`);
    console.log('────────────────────────────────────────\n');
  } catch (error) {
    console.error('\n❌ [Sync Prompts] Lỗi:', error);
    process.exit(1);
  } finally {
    await orm.close(true);
  }
}

syncPrompts();
