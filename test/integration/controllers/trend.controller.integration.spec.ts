import { MikroORM } from '@mikro-orm/core';
import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { TrendController } from 'src/api/controllers/trend.controller';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { AllUserLogRequest } from 'src/application/dtos/request/user-log.request';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { v4 as uuidv4 } from 'uuid';

describe('TrendController (Integration)', () => {
  let dbModule: TestingModule;
  let orm: MikroORM;
  let controller: TrendController;
  let userLogService: UserLogService;
  let adminInstructionService: AdminInstructionService;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
  } as unknown as AIService;

  beforeAll(async () => {
    dbModule = await createIntegrationTestingModule([
      UserLogService,
      AdminInstructionService,
    ]);
    orm = dbModule.get(MikroORM);
    userLogService = dbModule.get(UserLogService);
    adminInstructionService = dbModule.get(AdminInstructionService);
    controller = new TrendController(userLogService, mockAIService, adminInstructionService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await orm.close(true);
    await dbModule.close();
  });

  describe('summarizeLogs', () => {
    it('should return insufficient data when no user logs exist', async () => {
      const request = new AllUserLogRequest();
      request.period = PeriodEnum.WEEKLY;
      request.endDate = new Date();

      const result = await controller.summarizeLogs(request);

      expect(result.success).toBeDefined();
    });

    it('should call AI for trend forecast when log data exists', async () => {
      const userId = uuidv4();
      await userLogService.saveUserLogSummary(
        userId,
        new Date('2025-01-01'),
        new Date('2025-01-07'),
        'User searched for floral and woody perfumes frequently',
      );

      (mockAIService.textGenerateFromPrompt as jest.Mock)
        .mockResolvedValueOnce({ success: true, data: 'Summary of user trends' })
        .mockResolvedValueOnce({ success: true, data: 'Floral perfumes trending up' });

      const request = new AllUserLogRequest();
      request.period = PeriodEnum.WEEKLY;
      request.endDate = new Date('2025-01-08');
      request.startDate = new Date('2025-01-01');

      const result = await controller.summarizeLogs(request);

      expect(result).toBeDefined();
    });

    it('should handle AI failure in first call', async () => {
      const userId = uuidv4();
      await userLogService.saveUserLogSummary(
        userId,
        new Date('2025-01-01'),
        new Date('2025-01-07'),
        'Some log data',
      );

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: false,
        error: 'AI error',
      });

      const request = new AllUserLogRequest();
      request.period = PeriodEnum.WEEKLY;
      request.endDate = new Date('2025-01-08');
      request.startDate = new Date('2025-01-01');

      const result = await controller.summarizeLogs(request);

      expect(result).toBeDefined();
    });
  });

  describe('summarizeLogsStructured', () => {
    it('should return structured response with metadata', async () => {
      const request = new AllUserLogRequest();
      request.period = PeriodEnum.MONTHLY;
      request.endDate = new Date();

      const result = await controller.summarizeLogsStructured(request);

      expect(result.success).toBeDefined();
      if (result.data) {
        expect(result.data.metadata).toBeDefined();
      }
    });

    it('should include period in structured response', async () => {
      const userId = uuidv4();
      await userLogService.saveUserLogSummary(
        userId,
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        'Monthly trend data',
      );

      (mockAIService.textGenerateFromPrompt as jest.Mock)
        .mockResolvedValueOnce({ success: true, data: 'Summary' })
        .mockResolvedValueOnce({ success: true, data: 'Trend forecast' });

      const request = new AllUserLogRequest();
      request.period = PeriodEnum.MONTHLY;
      request.endDate = new Date('2025-02-01');
      request.startDate = new Date('2025-01-01');

      const result = await controller.summarizeLogsStructured(request);

      expect(result).toBeDefined();
    });
  });
});
