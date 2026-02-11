import { MikroORM } from '@mikro-orm/core';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { ADMIN_INSTRUCTION_SEED_DATA } from './admin-instruction-seed-data';
import { ALL_INSTRUCTION_TYPES } from 'src/application/constant/prompts/admin-instruction-types';

/**
 * Seed admin instructions vào database.
 * Idempotent: chỉ thêm instruction cho domain chưa có dữ liệu.
 *
 * Gọi trong main.ts sau khi migration hoàn tất.
 */
export async function seedAdminInstructions(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();

  try {
    // Kiểm tra từng domain type - chỉ seed nếu domain đó chưa có instruction nào
    for (const domainType of ALL_INSTRUCTION_TYPES) {
      const existingCount = await em.count(AdminInstruction, { instructionType: domainType });

      if (existingCount > 0) {
        console.log(`[Seeder] Domain "${domainType}" đã có ${existingCount} instruction(s), bỏ qua.`);
        continue;
      }

      // Lấy seed data cho domain này
      const seedItems = ADMIN_INSTRUCTION_SEED_DATA.filter(
        (item) => item.instructionType === domainType
      );

      if (seedItems.length === 0) {
        console.log(`[Seeder] Không có seed data cho domain "${domainType}", bỏ qua.`);
        continue;
      }

      // Tạo và persist entities
      for (const item of seedItems) {
        const instruction = new AdminInstruction({
          instruction: item.instruction,
          instructionType: item.instructionType
        });
        em.persist(instruction);
      }

      console.log(`[Seeder] Đã seed ${seedItems.length} instruction(s) cho domain "${domainType}".`);
    }

    await em.flush();
    console.log('[Seeder] Admin instruction seeding hoàn tất.');
  } catch (error) {
    console.error('[Seeder] Lỗi khi seed admin instructions:', error);
  }
}
