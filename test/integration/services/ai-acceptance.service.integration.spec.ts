import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { AIAcceptanceService } from 'src/infrastructure/servicies/ai-acceptance.service';
import { UnitOfWork } from 'src/infrastructure/repositories/unit-of-work';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { v4 as uuidv4 } from 'uuid';

describe('AIAcceptanceService (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let service: AIAcceptanceService;

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
  });

  beforeEach(async () => {
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  // ────────── CREATE ──────────
  describe('createAIAcceptanceRecord', () => {
    it('should create acceptance record in database', async () => {
      const result = await service.createAIAcceptanceRecord('user-1', true);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe('user-1');
      expect(result.data!.isAccepted).toBe(true);
    });

    it('should create multiple records for same user', async () => {
      await service.createAIAcceptanceRecord('user-1', true);
      await service.createAIAcceptanceRecord('user-1', false);

      // Both records should exist
      const rate = await service.getAIAcceptanceRateByAcceptanceStatusWithUserId('user-1');
      expect(rate.success).toBe(true);
      expect(rate.data).toBe(50); // 1 accepted / 2 total
    });
  });

  // ────────── READ ──────────
  describe('getAIAcceptanceByUserId', () => {
    it('should find acceptance record by userId', async () => {
      await service.createAIAcceptanceRecord('user-find', true);

      const result = await service.getAIAcceptanceByUserId('user-find');

      expect(result.success).toBe(true);
      expect(result.data!.userId).toBe('user-find');
      expect(result.data!.isAccepted).toBe(true);
    });

    it('should return error for non-existent userId', async () => {
      const result = await service.getAIAcceptanceByUserId('ghost-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ────────── UPDATE ──────────
  describe('updateAIAcceptanceStatusById', () => {
    it('should update acceptance status from true to false', async () => {
      const created = await service.createAIAcceptanceRecord('user-upd', true);

      const result = await service.updateAIAcceptanceStatusById(created.data!.id, false);

      expect(result.success).toBe(true);
      expect(result.data!.isAccepted).toBe(false);
    });

    it('should return error when record does not exist', async () => {
      const fakeId = uuidv4();
      const result = await service.updateAIAcceptanceStatusById(fakeId, false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ────────── AGGREGATION ──────────
  describe('getAIAcceptanceRateByAcceptanceStatus', () => {
    it('should return 0 when no records exist', async () => {
      const result = await service.getAIAcceptanceRateByAcceptanceStatus(true);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should calculate correct acceptance rate', async () => {
      // 3 accepted, 1 rejected -> 75% accepted rate
      await service.createAIAcceptanceRecord('u1', true);
      await service.createAIAcceptanceRecord('u2', true);
      await service.createAIAcceptanceRecord('u3', true);
      await service.createAIAcceptanceRecord('u4', false);

      const acceptedRate = await service.getAIAcceptanceRateByAcceptanceStatus(true);
      expect(acceptedRate.success).toBe(true);
      expect(acceptedRate.data).toBe(75);

      const rejectedRate = await service.getAIAcceptanceRateByAcceptanceStatus(false);
      expect(rejectedRate.success).toBe(true);
      expect(rejectedRate.data).toBe(25);
    });

    it('should return 100% when all records have same status', async () => {
      await service.createAIAcceptanceRecord('u1', true);
      await service.createAIAcceptanceRecord('u2', true);

      const rate = await service.getAIAcceptanceRateByAcceptanceStatus(true);
      expect(rate.success).toBe(true);
      expect(rate.data).toBe(100);
    });
  });

  describe('getAIAcceptanceRateByAcceptanceStatusWithUserId', () => {
    it('should calculate per-user acceptance rate', async () => {
      // user-a: 2 accepted, 1 rejected -> 66.67%
      await service.createAIAcceptanceRecord('user-a', true);
      await service.createAIAcceptanceRecord('user-a', true);
      await service.createAIAcceptanceRecord('user-a', false);

      // user-b: only accepted (should not affect user-a)
      await service.createAIAcceptanceRecord('user-b', true);

      const result = await service.getAIAcceptanceRateByAcceptanceStatusWithUserId('user-a');
      expect(result.success).toBe(true);
      expect(Math.round(result.data!)).toBe(67);
    });

    it('should return NaN rate for user with no records', async () => {
      const result = await service.getAIAcceptanceRateByAcceptanceStatusWithUserId('no-records');

      // find({ userId }) returns [] — ![] is false in JS, so it proceeds
      // acceptedCount(0) / length(0) = NaN
      expect(result.success).toBe(true);
      expect(result.data).toBeNaN();
    });
  });
});
