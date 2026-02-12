import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { AdminInstructionController } from 'src/api/controllers/admin-instruction.controller';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';

describe('AdminInstructionController (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let controller: AdminInstructionController;
  let service: AdminInstructionService;

  beforeAll(async () => {
    module = await createIntegrationTestingModule([AdminInstructionService]);
    orm = module.get(MikroORM);
    service = module.get(AdminInstructionService);
    controller = new AdminInstructionController(service);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  // ────────── GET ALL ──────────
  describe('getAllInstructions', () => {
    it('should return empty array when no instructions', async () => {
      const result = await controller.getAllInstructions();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return all instructions after creating some', async () => {
      await service.createInstruction({ instruction: 'Rule 1', instructionType: 'system' });
      await service.createInstruction({ instruction: 'Rule 2', instructionType: 'conversation' });

      const result = await controller.getAllInstructions();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  // ────────── GET BY ID ──────────
  describe('getInstructionById', () => {
    it('should return instruction by id from database', async () => {
      const created = await service.createInstruction({
        instruction: 'Always respond politely',
        instructionType: 'conversation',
      });
      const id = created.data!.id;

      const result = await controller.getInstructionById(id);
      expect(result.success).toBe(true);
      expect(result.data!.instruction).toBe('Always respond politely');
      expect(result.data!.instructionType).toBe('conversation');
    });

    it('should handle non-existent id', async () => {
      const result = await controller.getInstructionById('00000000-0000-0000-0000-000000000000');
      expect(result.success).toBe(false);
    });
  });

  // ────────── GET BY TYPE ──────────
  describe('getInstructionsByType', () => {
    it('should return instructions filtered by type', async () => {
      await service.createInstruction({ instruction: 'Conv 1', instructionType: 'conversation' });
      await service.createInstruction({ instruction: 'Review 1', instructionType: 'review' });
      await service.createInstruction({ instruction: 'Conv 2', instructionType: 'conversation' });

      const result = await controller.getInstructionsByType('conversation');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      result.data!.forEach((i) => expect(i.instructionType).toBe('conversation'));
    });

    it('should return empty for non-existent type', async () => {
      const result = await controller.getInstructionsByType('nonexistent');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────── GET COMBINED PROMPT ──────────
  describe('getCombinedPromptByType', () => {
    it('should combine instructions into single prompt string', async () => {
      await service.createInstruction({ instruction: 'Be concise', instructionType: 'system' });
      await service.createInstruction({ instruction: 'Be helpful', instructionType: 'system' });

      const result = await controller.getCombinedPromptByType('system');
      expect(result.success).toBe(true);
      expect(result.data).toContain('Be concise');
      expect(result.data).toContain('Be helpful');
    });
  });

  // ────────── CREATE ──────────
  describe('createInstruction', () => {
    it('should create instruction and persist to database', async () => {
      const result = await controller.createInstruction({
        instruction: 'Test instruction',
        instructionType: 'prompt',
      });

      expect(result.success).toBe(true);
      expect(result.data!.id).toBeDefined();
      expect(result.data!.instruction).toBe('Test instruction');

      // Verify via service (DB round-trip)
      const fetched = await service.getInstructionById(result.data!.id);
      expect(fetched.data!.instruction).toBe('Test instruction');
    });
  });

  // ────────── UPDATE ──────────
  describe('updateInstruction', () => {
    it('should update instruction in database', async () => {
      const created = await service.createInstruction({
        instruction: 'Original',
        instructionType: 'system',
      });
      const id = created.data!.id;

      const result = await controller.updateInstruction(id, {
        instruction: 'Updated',
      });
      expect(result.success).toBe(true);
      expect(result.data!.instruction).toBe('Updated');

      // Verify via DB
      const fetched = await service.getInstructionById(id);
      expect(fetched.data!.instruction).toBe('Updated');
    });
  });

  // ────────── DELETE ──────────
  describe('deleteInstruction', () => {
    it('should delete instruction from database', async () => {
      const created = await service.createInstruction({
        instruction: 'To be deleted',
        instructionType: 'rule',
      });
      const id = created.data!.id;

      const result = await controller.deleteInstruction(id);
      expect(result.success).toBe(true);

      // Verify deleted
      const fetched = await service.getInstructionById(id);
      expect(fetched.success).toBe(false);
    });

    it('should handle deleting non-existent instruction', async () => {
      const result = await controller.deleteInstruction('00000000-0000-0000-0000-000000000000');
      expect(result.success).toBe(false);
    });
  });
});
