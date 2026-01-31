import { AddPromptRequest } from '../../dtos/request/add-prompt.request';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';

export class AdminInstructionRequestMapper {
  static toEntity(request: AddPromptRequest): AdminInstruction {
    return new AdminInstruction({
      instruction: request.prompt,
      instructionType: request.requestType
    });
  }

  static toEntityList(requests: AddPromptRequest[]): AdminInstruction[] {
    return requests.map((request) => this.toEntity(request));
  }
}
