import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';

describe('AdminInstructionService (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let service: AdminInstructionService;

  beforeAll(async () => {
    module = await createIntegrationTestingModule([AdminInstructionService]);
    orm = module.get(MikroORM);
    service = module.get(AdminInstructionService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  // ────────── CREATE ──────────
  describe('createInstruction', () => {
    it('should persist instruction to database and return response', async () => {
      const result = await service.createInstruction({
        instruction: 'Always respond in Vietnamese',
        instructionType: 'conversation',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBeDefined();
      expect(result.data!.instruction).toBe('Always respond in Vietnamese');
      expect(result.data!.instructionType).toBe('conversation');
      expect(result.data!.createdAt).toBeInstanceOf(Date);

      // Verify in DB
      const dbResult = await service.getInstructionById(result.data!.id);
      expect(dbResult.success).toBe(true);
      expect(dbResult.data!.instruction).toBe('Always respond in Vietnamese');
    });

    it('should create multiple instructions of different types', async () => {
      await service.createInstruction({ instruction: 'Conversation rule 1', instructionType: 'conversation' });
      await service.createInstruction({ instruction: 'Review rule 1', instructionType: 'review' });
      await service.createInstruction({ instruction: 'Conversation rule 2', instructionType: 'conversation' });

      const all = await service.getAllInstructions();
      expect(all.success).toBe(true);
      expect(all.data).toHaveLength(3);
    });
  });

  // ────────── READ ──────────
  describe('getAllInstructions', () => {
    it('should return empty array when no instructions exist', async () => {
      const result = await service.getAllInstructions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return all instructions from database', async () => {
      await service.createInstruction({ instruction: 'Rule 1', instructionType: 'system' });
      await service.createInstruction({ instruction: 'Rule 2', instructionType: 'system' });

      const result = await service.getAllInstructions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getInstructionById', () => {
    it('should return instruction by id', async () => {
      const created = await service.createInstruction({
        instruction: 'Test instruction',
        instructionType: 'prompt',
      });

      const result = await service.getInstructionById(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.instruction).toBe('Test instruction');
    });

    it('should return error for non-existent id', async () => {
      const result = await service.getInstructionById('00000000-0000-0000-0000-000000000000');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getInstructionsByType', () => {
    it('should filter instructions by type', async () => {
      await service.createInstruction({ instruction: 'Conv 1', instructionType: 'conversation' });
      await service.createInstruction({ instruction: 'Rev 1', instructionType: 'review' });
      await service.createInstruction({ instruction: 'Conv 2', instructionType: 'conversation' });

      const result = await service.getInstructionsByType('conversation');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data!.every(i => i.instructionType === 'conversation')).toBe(true);
    });

    it('should return empty array for non-existent type', async () => {
      const result = await service.getInstructionsByType('non-existent');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getCombinedPromptByType', () => {
    it('should combine all instructions of the same type', async () => {
      await service.createInstruction({ instruction: 'Rule A', instructionType: 'recommendation' });
      await service.createInstruction({ instruction: 'Rule B', instructionType: 'recommendation' });

      const result = await service.getCombinedPromptByType('recommendation');

      expect(result.success).toBe(true);
      expect(result.data).toContain('Rule A');
      expect(result.data).toContain('Rule B');
    });
  });

  describe('getSystemPromptForDomain', () => {
    it('should return combined instructions for domain', async () => {
      await service.createInstruction({ instruction: 'Be helpful', instructionType: 'conversation' });
      await service.createInstruction({ instruction: 'Be concise', instructionType: 'conversation' });

      const result = await service.getSystemPromptForDomain('conversation');

      expect(result).toContain('Be helpful');
      expect(result).toContain('Be concise');
    });

    it('should return empty string when no instructions for domain', async () => {
      const result = await service.getSystemPromptForDomain('unknown-domain');

      expect(result).toBe('');
    });
  });

  // ────────── UPDATE ──────────
  describe('updateInstruction', () => {
    it('should update instruction content in database', async () => {
      const created = await service.createInstruction({
        instruction: 'Original',
        instructionType: 'system',
      });

      const updated = await service.updateInstruction(created.data!.id, {
        instruction: 'Updated content',
      });

      expect(updated.success).toBe(true);
      expect(updated.data!.instruction).toBe('Updated content');
      expect(updated.data!.instructionType).toBe('system'); // unchanged

      // Verify in DB
      const dbResult = await service.getInstructionById(created.data!.id);
      expect(dbResult.data!.instruction).toBe('Updated content');
    });

    it('should update instruction type', async () => {
      const created = await service.createInstruction({
        instruction: 'Content',
        instructionType: 'system',
      });

      const updated = await service.updateInstruction(created.data!.id, {
        instructionType: 'prompt',
      });

      expect(updated.success).toBe(true);
      expect(updated.data!.instructionType).toBe('prompt');
    });

    it('should return error when updating non-existent instruction', async () => {
      const result = await service.updateInstruction('non-existent-id', {
        instruction: 'New',
      });

      expect(result.success).toBe(false);
    });
  });

  // ────────── DELETE ──────────
  describe('deleteInstruction', () => {
    it('should remove instruction from database', async () => {
      const created = await service.createInstruction({
        instruction: 'To be deleted',
        instructionType: 'temp',
      });

      const deleteResult = await service.deleteInstruction(created.data!.id);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.data).toBe(true);

      // Verify deleted
      const getResult = await service.getInstructionById(created.data!.id);
      expect(getResult.success).toBe(false);
    });

    it('should return error when deleting non-existent instruction', async () => {
      const result = await service.deleteInstruction('non-existent-id');

      expect(result.success).toBe(false);
    });
  });
});
