import { Test, TestingModule } from '@nestjs/testing';
import { AdminInstructionController } from 'src/api/controllers/admin-instruction.controller';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { createMockAdminInstructionService } from '../../helpers/mock-factories';
import {
  successResponse,
  errorResponse,
  TEST_INSTRUCTION_ID,
} from '../../helpers/test-constants';

describe('AdminInstructionController', () => {
  let controller: AdminInstructionController;
  let service: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    service = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInstructionController],
      providers: [
        { provide: AdminInstructionService, useValue: service },
      ],
    }).compile();

    controller = module.get<AdminInstructionController>(AdminInstructionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /admin/instructions ──────────
  describe('getAllInstructions', () => {
    it('TC-FUNC-030: should return all instructions', async () => {
      const mockInstructions = [
        { id: '1', type: 'REVIEW', title: 'Review prompt', content: 'Analyze reviews' },
        { id: '2', type: 'ORDER', title: 'Order prompt', content: 'Summarize orders' },
      ];
      service.getAllInstructions.mockResolvedValue(successResponse(mockInstructions));

      const result = await controller.getAllInstructions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('TC-FUNC-031: should return empty array when no instructions', async () => {
      service.getAllInstructions.mockResolvedValue(successResponse([]));

      const result = await controller.getAllInstructions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────── GET /admin/instructions/:id ──────────
  describe('getInstructionById', () => {
    it('TC-FUNC-032: should return instruction by id', async () => {
      const mockInstruction = { id: TEST_INSTRUCTION_ID, type: 'REVIEW', content: 'Prompt' };
      service.getInstructionById.mockResolvedValue(successResponse(mockInstruction));

      const result = await controller.getInstructionById(TEST_INSTRUCTION_ID);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe(TEST_INSTRUCTION_ID);
      expect(service.getInstructionById).toHaveBeenCalledWith(TEST_INSTRUCTION_ID);
    });

    it('TC-NEG-030: should handle non-existent id', async () => {
      service.getInstructionById.mockResolvedValue(
        errorResponse('Instruction not found'),
      );

      const result = await controller.getInstructionById('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ────────── GET /admin/instructions/type/:type ──────────
  describe('getInstructionsByType', () => {
    it('TC-FUNC-033: should return instructions filtered by type', async () => {
      const mockInstructions = [
        { id: '1', type: 'REVIEW', content: 'Prompt 1' },
      ];
      service.getInstructionsByType.mockResolvedValue(successResponse(mockInstructions));

      const result = await controller.getInstructionsByType('REVIEW');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(service.getInstructionsByType).toHaveBeenCalledWith('REVIEW');
    });

    it('TC-FUNC-034: should return empty for unknown type', async () => {
      service.getInstructionsByType.mockResolvedValue(successResponse([]));

      const result = await controller.getInstructionsByType('UNKNOWN');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────── GET /admin/instructions/combined/:type ──────────
  describe('getCombinedPromptByType', () => {
    it('TC-FUNC-035: should return combined prompt string', async () => {
      service.getCombinedPromptByType.mockResolvedValue(
        successResponse('Combined prompt for REVIEW domain'),
      );

      const result = await controller.getCombinedPromptByType('REVIEW');

      expect(result.success).toBe(true);
      expect(result.data).toContain('REVIEW');
    });
  });

  // ────────── POST /admin/instructions ──────────
  describe('createInstruction', () => {
    it('TC-FUNC-036: should create new instruction', async () => {
      const createRequest = {
        instructionType: 'REVIEW',
        title: 'New review prompt',
        instruction: 'Analyze all reviews...',
        isActive: true,
      } as any;
      const createdInstruction = { id: 'new-id', ...createRequest };
      service.createInstruction.mockResolvedValue(successResponse(createdInstruction));

      const result = await controller.createInstruction(createRequest);

      expect(result.success).toBe(true);
      expect(result.data!.instructionType).toBe('REVIEW');
      expect(service.createInstruction).toHaveBeenCalledWith(createRequest);
    });

    it('TC-VAL-030: should validate required fields through service', async () => {
      service.createInstruction.mockResolvedValue(
        errorResponse('Type and content are required'),
      );

      const result = await controller.createInstruction({} as any);

      expect(result.success).toBe(false);
    });
  });

  // ────────── PUT /admin/instructions/:id ──────────
  describe('updateInstruction', () => {
    it('TC-FUNC-037: should update existing instruction', async () => {
      const updateRequest = { instruction: 'Updated content' } as any;
      service.updateInstruction.mockResolvedValue(
        successResponse({ id: TEST_INSTRUCTION_ID, instruction: 'Updated content' }),
      );

      const result = await controller.updateInstruction(TEST_INSTRUCTION_ID, updateRequest);

      expect(result.success).toBe(true);
      expect(result.data!.instruction).toBe('Updated content');
      expect(service.updateInstruction).toHaveBeenCalledWith(TEST_INSTRUCTION_ID, updateRequest);
    });

    it('TC-NEG-031: should handle update on non-existent id', async () => {
      service.updateInstruction.mockResolvedValue(
        errorResponse('Instruction not found'),
      );

      const result = await controller.updateInstruction('bad-id', {} as any);

      expect(result.success).toBe(false);
    });
  });

  // ────────── DELETE /admin/instructions/:id ──────────
  describe('deleteInstruction', () => {
    it('TC-FUNC-038: should delete instruction by id', async () => {
      service.deleteInstruction.mockResolvedValue(successResponse(true));

      const result = await controller.deleteInstruction(TEST_INSTRUCTION_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(service.deleteInstruction).toHaveBeenCalledWith(TEST_INSTRUCTION_ID);
    });

    it('TC-NEG-032: should handle delete on non-existent id', async () => {
      service.deleteInstruction.mockResolvedValue(
        errorResponse('Instruction not found'),
      );

      const result = await controller.deleteInstruction('bad-id');

      expect(result.success).toBe(false);
    });
  });
});
