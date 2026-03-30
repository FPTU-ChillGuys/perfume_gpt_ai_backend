import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { AIAcceptanceController } from 'src/api/controllers/ai-acceptance.controller';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { v4 as uuidv4 } from 'uuid';

describe('AIAcceptanceController (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let controller: AIAcceptanceController;
  let service: AIAcceptanceService;

  const userId = uuidv4();

  beforeAll(async () => {
    // AIAcceptanceService is missing @Injectable(), so use factory
    module = await createIntegrationTestingModule([
      {
        provide: AIAcceptanceService,
        useFactory: (uow: UnitOfWork) => new AIAcceptanceService(uow),
        inject: [UnitOfWork],
      },
    ]);
    orm = module.get(MikroORM);
    service = module.get(AIAcceptanceService);
    controller = new AIAcceptanceController(service);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  // ────────── CREATE RECORD ──────────
  describe('createAIAcceptanceRecord', () => {
    it('should create acceptance record and persist to DB', async () => {
      const result = await controller.createAIAcceptanceRecord(userId, 'true');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe(userId);
    });

    it('should handle isAccepted=false (inverted logic)', async () => {
      const result = await controller.createAIAcceptanceRecord(userId, 'false');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  // ────────── GET STATUS ──────────
  describe('getAIAcceptanceStatus', () => {
    it('should return error when no record exists', async () => {
      const result = await controller.getAIAcceptanceStatus(uuidv4());
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return the latest acceptance record for user', async () => {
      await service.createAIAcceptanceRecord(userId, true);

      const result = await controller.getAIAcceptanceStatus(userId);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe(userId);
    });
  });

  // ────────── UPDATE STATUS ──────────
  describe('updateAIAcceptanceData', () => {
    it('should update acceptance status by record id', async () => {
      const created = await service.createAIAcceptanceRecord(userId, false);
      const recordId = created.data!.id;

      const result = await controller.updateAIAcceptanceData(recordId, 'true');
      expect(result.success).toBe(true);
      expect(result.data!.isAccepted).toBe(true);
    });
  });

  // ────────── RATE ──────────
  describe('getAIAcceptanceRate', () => {
    it('should return acceptance rate for a given status', async () => {
      await service.createAIAcceptanceRecord(userId, true);
      await service.createAIAcceptanceRecord(userId, true);
      await service.createAIAcceptanceRecord(userId, false);

      const result = await controller.getAIAcceptanceRate('true');
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('number');
    });
  });

  // ────────── RATE BY USER ──────────
  describe('getAIAcceptanceRateByUserId', () => {
    it('should return rate for specific user', async () => {
      await service.createAIAcceptanceRecord(userId, true);
      await service.createAIAcceptanceRecord(userId, false);

      const result = await controller.getAIAcceptanceRateByUserId(userId);
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('number');
    });

    it('should return NaN for user with no records', async () => {
      const result = await controller.getAIAcceptanceRateByUserId(uuidv4());
      expect(result.success).toBe(true);
      expect(result.data).toBeNaN();
    });
  });
});
