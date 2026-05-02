import { Injectable } from '@nestjs/common';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { BaseRepository } from './base/base.repository';

/** Repository thao tác dữ liệu AdminInstruction */
@Injectable()
export class AdminInstructionRepository extends BaseRepository<AdminInstruction> {
  /**
   * Lấy tất cả chỉ thị theo loại (instructionType).
   * @param type - Loại chỉ thị cần lọc
   */
  async findByType(type: string): Promise<AdminInstruction[]> {
    return this.find({ instructionType: type, isActive: true });
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
}
