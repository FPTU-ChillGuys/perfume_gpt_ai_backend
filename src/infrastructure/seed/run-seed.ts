/**
 * Standalone seed runner - Chạy seed admin instructions độc lập.
 *
 * Sử dụng: pnpm run seed
 *
 * File này khởi tạo MikroORM từ config, chạy seeder, rồi đóng kết nối.
 * Không cần khởi động NestJS app.
 */
import { MikroORM } from '@mikro-orm/core';
import { seedAdminInstructions } from './admin-instruction.seeder';
import mikroConfig from 'mikro-orm.config';

async function runSeed() {
  console.log('[Seed Runner] Đang kết nối database...');

  const config = await mikroConfig();
  const orm = await MikroORM.init(config);

  try {
    // Chạy migration trước (đảm bảo bảng đã tồn tại)
    const pendingMigrations = await orm.migrator.getPendingMigrations();
    if (pendingMigrations.length > 0) {
      console.log(
        `[Seed Runner] Áp dụng ${pendingMigrations.length} migration(s) trước khi seed...`
      );
      await orm.migrator.up();
    }

    // Chạy seed
    await seedAdminInstructions(orm);

    console.log('[Seed Runner] Hoàn tất!');
  } catch (error) {
    console.error('[Seed Runner] Lỗi:', error);
    process.exit(1);
  } finally {
    await orm.close(true);
  }
}

runSeed();
