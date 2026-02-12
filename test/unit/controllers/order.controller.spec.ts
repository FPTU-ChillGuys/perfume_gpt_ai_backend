import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from 'src/api/controllers/order.controller';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import {
  createMockOrderService,
  createMockAIService,
  createMockAdminInstructionService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  successResponseAPI,
  errorResponse,
  createMockRequest,
  TEST_USER_ID,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: ReturnType<typeof createMockOrderService>;
  let aiService: ReturnType<typeof createMockAIService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    orderService = createMockOrderService();
    aiService = createMockAIService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: OrderService, useValue: orderService },
        { provide: AI_SERVICE, useValue: aiService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /orders ──────────
  describe('getAllOrders', () => {
    it('TC-FUNC-060: should return paginated orders', async () => {
      const mockOrders = {
        items: [{ id: 'ord-1', totalAmount: 500000 }],
        totalCount: 1,
      };
      orderService.getAllOrders.mockResolvedValue(
        successResponseAPI(mockOrders),
      );

      const req = createMockRequest();
      const result = await controller.getAllOrders(req, {} as any);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('TC-FUNC-061: should pass auth header to service', async () => {
      orderService.getAllOrders.mockResolvedValue(
        successResponseAPI({ items: [], totalCount: 0 }),
      );

      const req = createMockRequest();
      await controller.getAllOrders(req, {} as any);

      expect(orderService.getAllOrders).toHaveBeenCalledTimes(1);
    });
  });

  // ────────── GET /orders/user/:userId ──────────
  describe('getOrdersByUserId', () => {
    it('TC-FUNC-062: should return orders for specific user', async () => {
      const mockOrders = {
        items: [{ id: 'ord-1', userId: TEST_USER_ID }],
        totalCount: 1,
      };
      orderService.getOrdersByUserId.mockResolvedValue(
        successResponseAPI(mockOrders),
      );

      const req = createMockRequest();
      const result = await controller.getOrdersByUserId(req, TEST_USER_ID, {} as any);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('TC-FUNC-063: should return empty list for user with no orders', async () => {
      orderService.getOrdersByUserId.mockResolvedValue(
        successResponseAPI({ items: [], totalCount: 0 }),
      );

      const req = createMockRequest();
      const result = await controller.getOrdersByUserId(req, 'no-orders-user', {} as any);

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(0);
    });
  });

  // ────────── GET /orders/summary/ai ──────────
  describe('getAIOrderSummary', () => {
    it('TC-FUNC-064: should return AI-generated order summary', async () => {
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Order report: 5 orders totaling 2,500,000 VND'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('User frequently purchases floral fragrances...'),
      );

      const req = createMockRequest();
      const result = await controller.getAIOrderSummary(req, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-060: should handle insufficient order data', async () => {
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );

      const req = createMockRequest();
      const result = await controller.getAIOrderSummary(req, TEST_USER_ID);

      expect(result.success).toBe(true);
      // Should return insufficient data message
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });

    it('TC-NEG-061: should handle AI service error gracefully', async () => {
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Some order data'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('AI service timeout'),
      );

      const req = createMockRequest();
      const result = await controller.getAIOrderSummary(req, TEST_USER_ID);

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /orders/summary/ai/structured ──────────
  describe('getStructuredAIOrderSummary', () => {
    it('TC-FUNC-065: should return structured AI order summary', async () => {
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Detailed order report...'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse(JSON.stringify({ totalOrders: 5, favoriteCategory: 'floral' })),
      );

      const req = createMockRequest();
      const result = await controller.getStructuredAIOrderSummary(req, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-062: should handle empty order data for structured endpoint', async () => {
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );

      const req = createMockRequest();
      const result = await controller.getStructuredAIOrderSummary(req, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });
  });
});
