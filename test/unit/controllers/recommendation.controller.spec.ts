import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationController } from 'src/api/controllers/recommendation.controller';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { AI_SERVICE } from 'src/infrastructure/domain/ai/ai.module';
import {
  createMockUserLogService,
  createMockOrderService,
  createMockAIService,
  createMockAdminInstructionService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  errorResponse,
  createMockRequest,
  TEST_USER_ID,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('RecommendationController', () => {
  let controller: RecommendationController;
  let userLogService: ReturnType<typeof createMockUserLogService>;
  let orderService: ReturnType<typeof createMockOrderService>;
  let aiService: ReturnType<typeof createMockAIService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    userLogService = createMockUserLogService();
    orderService = createMockOrderService();
    aiService = createMockAIService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationController],
      providers: [
        { provide: UserLogService, useValue: userLogService },
        { provide: OrderService, useValue: orderService },
        { provide: AI_SERVICE, useValue: aiService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<RecommendationController>(RecommendationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── POST /recommendation/repurchase/v1 ──────────
  describe('repurchaseRecommendationV1', () => {
    it('TC-FUNC-130: should return repurchase recommendation v1', async () => {
      const req = createMockRequest();
      const request = { userId: TEST_USER_ID, period: 'MONTHLY', startDate: new Date(), endDate: new Date() } as any;

      // V1 uses getUserLogSummaryReportByUserId + orderReport
      userLogService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('User log summary: interested in floral perfumes'),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Order data: 5 orders of floral perfumes'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Consider repurchasing Dior J\'adore...'),
      );

      const result = await controller.repurchaseRecommendationV1(req, request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-130: should handle insufficient order data', async () => {
      const req = createMockRequest();
      const request = { userId: TEST_USER_ID, period: 'MONTHLY', startDate: new Date(), endDate: new Date() } as any;

      userLogService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );

      const result = await controller.repurchaseRecommendationV1(req, request);

      expect(result.success).toBe(true);
      // Should return insufficient data message
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });
  });

  // ────────── POST /recommendation/repurchase/v2 ──────────
  describe('repurchaseRecommendationV2', () => {
    it('TC-FUNC-131: should return repurchase recommendation v2 with log data', async () => {
      const req = createMockRequest();
      const request = { userId: TEST_USER_ID, period: 'MONTHLY' } as any;

      // V2 uses getReportAndPromptSummaryUserLogs + orderReport
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'User logs', response: 'Active user' }),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Orders: Dior Sauvage, Chanel No.5'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Based on orders and activity, recommend repurchase of Dior Sauvage'),
      );

      const result = await controller.repurchaseRecommendationV2(req, request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-131: should handle both order and log data missing', async () => {
      const req = createMockRequest();
      const request = { userId: 'new-user', period: 'MONTHLY' } as any;

      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );

      const result = await controller.repurchaseRecommendationV2(req, request);

      expect(result.success).toBe(true);
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });
  });

  // ────────── POST /recommendation/recommend/ai/v1 ──────────
  describe('aiRecommendationV1', () => {
    it('TC-FUNC-132: should return AI recommendation based on logs', async () => {
      const request = { userId: TEST_USER_ID, period: 'WEEKLY' } as any;

      // V1 uses getReportAndPromptSummaryUserLogs
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'User is interested in woody scents', response: 'data' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Recommend: Tom Ford Oud Wood, Le Labo Santal 33'),
      );

      const result = await controller.aiRecommendationV1(request);

      expect(result.success).toBe(true);
      expect(result.data).toContain('Recommend');
    });

    it('TC-NEG-132: should handle no user activity', async () => {
      const request = { userId: 'inactive-user', period: 'WEEKLY' } as any;

      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );

      const result = await controller.aiRecommendationV1(request);

      expect(result.success).toBe(true);
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });
  });

  // ────────── POST /recommendation/recommend/ai/v2 ──────────
  describe('aiRecommendationV2', () => {
    it('TC-FUNC-133: should return AI recommendation v2 with summary report', async () => {
      const request = { userId: TEST_USER_ID, period: 'MONTHLY', startDate: new Date(), endDate: new Date() } as any;

      // V2 uses getUserLogSummaryReportByUserId
      userLogService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('User preferences summary'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('V2 recommendation: Seasonal picks...'),
      );

      const result = await controller.aiRecommendationV2(request);

      expect(result.success).toBe(true);
    });
  });

  // ────────── POST /recommendation/recommend/ai/structured ──────────
  describe('aiRecommendationStructured', () => {
    it('TC-FUNC-134: should return structured AI recommendation', async () => {
      const request = { userId: TEST_USER_ID, period: 'MONTHLY' } as any;

      // Structured uses getReportAndPromptSummaryUserLogs
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'User data', response: 'report' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse(JSON.stringify({
          recommendations: [
            { productName: 'Chanel No.5', reason: 'Matches floral preference' },
          ],
          confidence: 0.85,
        })),
      );

      const result = await controller.aiRecommendationStructured(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-133: should handle insufficient data for structured', async () => {
      const request = { userId: 'new-user', period: 'WEEKLY' } as any;

      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );

      const result = await controller.aiRecommendationStructured(request);

      expect(result.success).toBe(true);
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });

    it('TC-NEG-134: should handle AI failure in structured response', async () => {
      const request = { userId: TEST_USER_ID, period: 'MONTHLY' } as any;

      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'data', response: 'report' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('Model overloaded'),
      );

      const result = await controller.aiRecommendationStructured(request);

      expect(result.success).toBe(false);
    });
  });
});
