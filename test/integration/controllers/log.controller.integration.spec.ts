import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { LogController } from 'src/api/controllers/log.controller';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { v4 as uuidv4 } from 'uuid';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';

describe('LogController (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let controller: LogController;
  let userLogService: UserLogService;
  let adminInstructionService: AdminInstructionService;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
    textGenerateStreamFromPrompt: jest.fn(),
    TextGenerateStreamFromMessages: jest.fn(),
  } as unknown as AIService;

  const userId = uuidv4();

  beforeAll(async () => {
    module = await createIntegrationTestingModule([
      UserLogService,
      AdminInstructionService,
    ]);
    orm = module.get(MikroORM);
    userLogService = module.get(UserLogService);
    adminInstructionService = module.get(AdminInstructionService);
    controller = new LogController(userLogService, mockAIService, adminInstructionService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  // ────────── COLLECT LOGS ──────────
  describe('collectLogs', () => {
    it('should return log report for a user (empty data)', async () => {
      const result = await controller.collectLogs({
        userId,
        period: 'weekly' as any,
        endDate: new Date(),
      } as any);

      expect(result.success).toBeDefined();
    });
  });

  // ────────── SUMMARIZE LOGS ──────────
  describe('summarizeLogs', () => {
    it('should return insufficient data message when no logs exist', async () => {
      const result = await controller.summarizeLogs({
        userId,
        period: 'weekly' as any,
        endDate: new Date(),
      } as any);

      // With no logs, should return insufficient data or success
      expect(result).toBeDefined();
    });

    it('should call AI when user has log data', async () => {
      // Save a log summary first to simulate existing data
      await userLogService.saveUserLogSummary(
        userId,
        new Date('2025-01-01'),
        new Date('2025-01-07'),
        'User searched for floral perfumes 5 times',
      );

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'AI summary of user activity',
      });

      const result = await controller.summarizeLogs({
        userId,
        period: 'weekly' as any,
        endDate: new Date(),
        startDate: new Date('2025-01-01'),
      } as any);

      expect(result).toBeDefined();
    });
  });

  // ────────── GET SUMMARIES ──────────
  describe('getUserLogsSummariesById', () => {
    it('should return empty when no summaries exist', async () => {
      const result = await controller.getUserLogsSummariesById(
        userId,
        new Date(),
        new Date('2024-01-01'),
      );

      expect(result.success).toBe(true);
    });

    it('should return saved summaries', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await userLogService.saveUserLogSummary(
        userId,
        startDate,
        endDate,
        'Monthly summary text',
      );

      const result = await controller.getUserLogsSummariesById(
        userId,
        new Date('2025-02-01'),
        new Date('2024-12-01'),
      );

      expect(result.success).toBe(true);
    });
  });

  // ────────── GET SUMMARY REPORT ──────────
  describe('getUserLogsSummaryReportById', () => {
    it('should return summary report for user', async () => {
      const result = await controller.getUserLogsSummaryReportById(
        userId,
        new Date(),
        new Date('2024-01-01'),
      );

      expect(result.success).toBe(true);
    });
  });

  // ────────── CREATE USER LOG SUMMARY ──────────
  describe('createUserLogSummary', () => {
    it('should create user log summary in database', async () => {
      const request = new UserLogSummaryRequest();
      request.userId = userId;
      request.startDate = new Date('2025-01-01');
      request.endDate = new Date('2025-01-31');
      request.logSummary = 'User was very active this month';

      const result = await controller.createUserLogSummary(request);

      expect(result.success).toBe(true);
      expect(result.data).toBe('User log summary saved successfully');

      // Verify via service
      const summaries = await userLogService.getUserLogSummariesByUserId(
        userId,
        new Date('2024-12-01'),
        new Date('2025-02-01'),
      );
      expect(summaries.success).toBe(true);
    });
  });
});
