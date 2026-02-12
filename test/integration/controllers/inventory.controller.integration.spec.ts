import { MikroORM } from '@mikro-orm/core';
import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { InventoryController } from 'src/api/controllers/inventory.controller';
import { InventoryService } from 'src/infrastructure/servicies/inventory.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { Request } from 'express';

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

describe('InventoryController (Integration)', () => {
  let dbModule: TestingModule;
  let orm: MikroORM;
  let controller: InventoryController;
  let inventoryService: InventoryService;
  let adminInstructionService: AdminInstructionService;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
  } as unknown as AIService;

  beforeAll(async () => {
    dbModule = await createIntegrationTestingModule([AdminInstructionService]);
    orm = dbModule.get(MikroORM);
    adminInstructionService = dbModule.get(AdminInstructionService);

    const httpModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();
    inventoryService = httpModule.get(InventoryService);

    controller = new InventoryController(inventoryService, mockAIService, adminInstructionService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await orm.close(true);
    await dbModule.close();
  });

  describe('getInventoryStock', () => {
    it('should return inventory stock from external API', async () => {
      const apiData = {
        success: true,
        payload: {
          items: [{ id: '1', productName: 'Perfume A', quantity: 100 }],
          totalCount: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const result = await controller.getInventoryStock(mockRequest(), {} as any);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should handle API failure', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));

      const result = await controller.getInventoryStock(mockRequest(), {} as any);

      expect(result.success).toBe(false);
    });
  });

  describe('getBatch', () => {
    it('should return batch data from external API', async () => {
      const apiData = {
        success: true,
        payload: {
          items: [{ id: '1', batchCode: 'BATCH-001' }],
          totalCount: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const result = await controller.getBatch(mockRequest(), {} as any);

      expect(result.success).toBe(true);
    });
  });

  describe('getInventoryReport', () => {
    it('should return inventory report string', async () => {
      const stockData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(stockData)));

      const result = await controller.getInventoryReport(mockRequest());

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });
  });

  describe('getAIInventoryReport', () => {
    it('should call AI even with empty stock/batch (report has headers)', async () => {
      const stockData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(stockData)));

      // Report always has headers (--- Inventory Stock Report --- etc.) even with empty data
      // so isDataEmpty returns false and AI is called
      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'AI inventory analysis: No stock data available',
      });

      const result = await controller.getAIInventoryReport(mockRequest());

      expect(result.success).toBe(true);
    });

    it('should call AI with report data when available', async () => {
      const stockData = {
        success: true,
        payload: {
          items: [{ id: '1', productName: 'Perfume A', quantity: 50, variantName: 'V1' }],
          totalCount: 1,
        },
      };
      const batchData = {
        success: true,
        payload: {
          items: [{ id: '1', batchCode: 'B1', quantity: 100 }],
          totalCount: 1,
        },
      };
      // Stock call then batch call
      mockHttpService.get
        .mockReturnValueOnce(of(axiosResponse(stockData)))
        .mockReturnValueOnce(of(axiosResponse(batchData)));

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'AI inventory report analysis',
      });

      const result = await controller.getAIInventoryReport(mockRequest());

      expect(result).toBeDefined();
    });
  });

  describe('getStructuredAIInventoryReport', () => {
    it('should return structured response with metadata', async () => {
      const stockData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(stockData)));

      const result = await controller.getStructuredAIInventoryReport(mockRequest());

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});
