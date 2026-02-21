import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from 'src/api/controllers/inventory.controller';
import { InventoryService } from 'src/infrastructure/servicies/inventory.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import {
  createMockInventoryService,
  createMockAIService,
  createMockAdminInstructionService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  successResponseAPI,
  errorResponse,
  createMockRequest,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: ReturnType<typeof createMockInventoryService>;
  let aiService: ReturnType<typeof createMockAIService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    inventoryService = createMockInventoryService();
    aiService = createMockAIService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: inventoryService },
        { provide: AI_SERVICE, useValue: aiService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /inventory/stock ──────────
  describe('getInventoryStock', () => {
    it('TC-FUNC-090: should return paginated stock data', async () => {
      const mockStock = {
        items: [{ id: '1', productName: 'Dior Sauvage', quantity: 50 }],
        totalCount: 1,
      };
      inventoryService.getInventoryStock.mockResolvedValue(
        successResponseAPI(mockStock),
      );

      const req = createMockRequest();
      const result = await controller.getInventoryStock({} as any);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });
  });

  // ────────── GET /inventory/batches ──────────
  describe('getBatch', () => {
    it('TC-FUNC-091: should return batch data', async () => {
      const mockBatches = {
        items: [{ id: '1', batchNumber: 'B001', expiryDate: new Date() }],
        totalCount: 1,
      };
      inventoryService.getBatch.mockResolvedValue(
        successResponseAPI(mockBatches),
      );

      const req = createMockRequest();
      const result = await controller.getBatch({} as any);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });
  });

  // ────────── GET /inventory/report ──────────
  describe('getInventoryReport', () => {
    it('TC-FUNC-092: should return inventory report string', async () => {
      inventoryService.createReportFromBatchAndStock.mockResolvedValue(
        'Stock Report: 100 items, 5 expiring soon',
      );

      const req = createMockRequest();
      const result = await controller.getInventoryReport();

      expect(result.success).toBe(true);
      expect(result.data).toContain('Stock');
    });

    it('TC-NEG-090: should handle empty inventory data', async () => {
      inventoryService.createReportFromBatchAndStock.mockResolvedValue('');

      const req = createMockRequest();
      const result = await controller.getInventoryReport();

      expect(result.success).toBe(true);
    });
  });

  // ────────── GET /inventory/report/ai ──────────
  describe('getAIInventoryReport', () => {
    it('TC-FUNC-093: should return AI-analyzed inventory report', async () => {
      inventoryService.createReportFromBatchAndStock.mockResolvedValue(
        'Inventory: 200 products, 10 low stock',
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Analysis: 10 products need immediate restocking...'),
      );

      const req = createMockRequest();
      const result = await controller.getAIInventoryReport();

      expect(result.success).toBe(true);
      expect(result.data).toContain('restocking');
    });

    it('TC-NEG-091: should handle insufficient inventory data', async () => {
      inventoryService.createReportFromBatchAndStock.mockResolvedValue('');

      const req = createMockRequest();
      const result = await controller.getAIInventoryReport();

      expect(result.success).toBe(true);
      // Should not call AI when no data
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });

    it('TC-NEG-092: should handle AI service error', async () => {
      inventoryService.createReportFromBatchAndStock.mockResolvedValue('Some data');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('AI error'),
      );

      const req = createMockRequest();
      const result = await controller.getAIInventoryReport();

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /inventory/report/ai/structured ──────────
  describe('getStructuredAIInventoryReport', () => {
    it('TC-FUNC-094: should return structured AI inventory report', async () => {
      inventoryService.createReportFromBatchAndStock.mockResolvedValue('Report data...');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse(JSON.stringify({
          totalProducts: 200,
          lowStockItems: 10,
          recommendations: ['Restock item A'],
        })),
      );

      const req = createMockRequest();
      const result = await controller.getStructuredAIInventoryReport();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});
