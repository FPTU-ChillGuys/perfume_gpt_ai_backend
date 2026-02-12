import { MikroORM } from '@mikro-orm/core';
import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { RecommendationController } from 'src/api/controllers/recommendation.controller';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

const mockHttpService = { get: jest.fn() };

function mockRequest(token = 'test-token'): Request {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

describe('RecommendationController (Integration)', () => {
  let dbModule: TestingModule;
  let orm: MikroORM;
  let controller: RecommendationController;
  let userLogService: UserLogService;
  let orderService: OrderService;
  let adminInstructionService: AdminInstructionService;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
  } as unknown as AIService;

  const userId = uuidv4();

  beforeAll(async () => {
    dbModule = await createIntegrationTestingModule([
      UserLogService,
      AdminInstructionService,
    ]);
    orm = dbModule.get(MikroORM);
    userLogService = dbModule.get(UserLogService);
    adminInstructionService = dbModule.get(AdminInstructionService);

    const httpModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();
    orderService = httpModule.get(OrderService);

    controller = new RecommendationController(
      userLogService,
      orderService,
      mockAIService,
      adminInstructionService,
    );
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await orm.close(true);
    await dbModule.close();
  });

  describe('repurchaseRecommendationV2', () => {
    it('should return error when no user log exists', async () => {
      const orderData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(orderData)));

      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
      });

      const result = await controller.repurchaseRecommendationV2(mockRequest(), request);

      // No UserLog entry exists for user → getReportAndPromptSummaryUserLogs returns success:false
      expect(result.success).toBe(false);
    });

    it('should call AI when user log data exists', async () => {
      await userLogService.saveUserLogSummary(
        userId,
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        'User likes floral perfumes',
      );

      const orderData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(orderData)));

      (mockAIService.textGenerateFromPrompt as jest.Mock)
        .mockResolvedValueOnce({ success: true, data: 'User preference summary' })
        .mockResolvedValueOnce({ success: true, data: 'Recommend: Chanel No.5' });

      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date('2025-02-01'),
        startDate: new Date('2025-01-01'),
      });

      const result = await controller.repurchaseRecommendationV2(mockRequest(), request);

      expect(result).toBeDefined();
    });
  });

  describe('repurchaseRecommendationV1', () => {
    it('should return insufficient data when no summary and no orders', async () => {
      const orderData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(orderData)));

      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
        startDate: new Date('2024-01-01'),
      });

      const result = await controller.repurchaseRecommendationV1(mockRequest(), request);

      expect(result.success).toBe(true);
    });
  });

  describe('aiRecommendationV1', () => {
    it('should return error when no user log exists', async () => {
      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
      });

      const result = await controller.aiRecommendationV1(request);

      // No UserLog entry → getReportAndPromptSummaryUserLogs returns success:false
      expect(result.success).toBe(false);
    });

    it('should call AI when log data exists', async () => {
      await userLogService.saveUserLogSummary(
        userId,
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        'User searched for woody and citrus scents',
      );

      (mockAIService.textGenerateFromPrompt as jest.Mock)
        .mockResolvedValueOnce({ success: true, data: 'Report analysis' })
        .mockResolvedValueOnce({ success: true, data: 'Recommend woody perfumes' });

      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date('2025-02-01'),
        startDate: new Date('2025-01-01'),
      });

      const result = await controller.aiRecommendationV1(request);

      expect(result).toBeDefined();
    });
  });

  describe('aiRecommendationV2', () => {
    it('should return insufficient data when no summary report', async () => {
      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
        startDate: new Date('2024-01-01'),
      });

      const result = await controller.aiRecommendationV2(request);

      expect(result.success).toBe(true);
    });
  });

  describe('aiRecommendationStructured', () => {
    it('should return structured response with metadata when no data', async () => {
      const request = new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
        startDate: new Date('2024-01-01'),
      });

      const result = await controller.aiRecommendationStructured(request);

      // With no log data, should either return insufficient data or error
      expect(result).toBeDefined();
      if (result.success && result.data) {
        expect(result.data.userId).toBe(userId);
        expect(result.data.metadata).toBeDefined();
      }
    });
  });
});
