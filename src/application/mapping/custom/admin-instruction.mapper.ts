import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';

export class AdminInstructionMapper {
  static toResponse(entity: AdminInstruction): any {
    return {
      id: entity.id,
      instruction: entity.instruction,
      instructionType: entity.instructionType,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  static toResponseList(entities: AdminInstruction[]): any[] {
    return entities.map((entity) => this.toResponse(entity));
  }

  //  static toEntity(request: AddPromptRequest): AdminInstruction {
  //   return new AdminInstruction({
  //     instruction: request.prompt,
  //     instructionType: request.requestType
  //   });
  // }

  // static toEntityList(requests: AddPromptRequest[]): AdminInstruction[] {
  //   return requests.map((request) => this.toEntity(request));
  // }
}
