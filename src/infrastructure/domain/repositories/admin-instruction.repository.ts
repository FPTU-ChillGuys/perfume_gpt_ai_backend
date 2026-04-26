import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';

/** Repository thao tác dữ liệu AdminInstruction */
@Injectable()
export class AdminInstructionRepository extends SqlEntityRepository<AdminInstruction> {

  /**
   * Lấy tất cả chỉ thị theo loại (instructionType).
   * @param type - Loại chỉ thị cần lọc
   */
  async findByType(type: string): Promise<AdminInstruction[]> {
    return this.find({ instructionType: type });
  }

  /**
   * Gộp tất cả chỉ thị theo loại thành một chuỗi prompt.
   * @param type - Loại chỉ thị cần gộp
   * @returns Chuỗi prompt đã gộp
   */
  async getCombinedInstructionsByType(type: string): Promise<string> {
    const instructions = await this.findByType(type);
    return instructions.map((i) => i.instruction).join('\n');
  }

  /** Thêm entity mới (cần gọi flush sau đó) */
  add(entity: AdminInstruction): void {
    this.getEntityManager().persist(entity);
  }

  /** Xóa entity (cần gọi flush sau đó) */
  remove(entity: AdminInstruction): void {
    this.getEntityManager().remove(entity);
  }

  /** Force đồng bộ dữ liệu với DB */
  async flush(): Promise<void> {
    await this.getEntityManager().flush();
  }
}
