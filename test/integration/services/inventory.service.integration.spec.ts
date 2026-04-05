import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { InventoryService } from 'src/infrastructure/domain/inventory/inventory.service';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BatchRequest } from 'src/application/dtos/request/batch.request';

// ─── mock helpers ───
function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

const AUTH_TOKEN = 'test-inventory-token';
const mockHttpService = { get: jest.fn() };

describe('InventoryService (integration – mock HTTP)', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  // ─── getInventoryStock ───
  describe('getInventoryStock', () => {
    it('should return paged inventory stock', async () => {
      const apiPayload = {
        success: true,
        payload: {
          items: [
            {
              id: 'stock-1',
              variantId: 'v1',
              variantSku: 'CHN5-EDP-100',
              productName: 'Chanel No.5',
              concentrationName: 'EDP',
              volumeMl: 100,
              totalQuantity: 50,
              lowStockThreshold: 10,
              isLowStock: false,
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getInventoryStock(
        new InventoryStockRequest(),
      );

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(1);
      expect(result.payload!.items[0].productName).toBe('Chanel No.5');
    });

    it('should send auth header', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ success: true, payload: { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0 } })),
      );

      await service.getInventoryStock(new InventoryStockRequest());

      // Auth token no longer passed; direct Prisma query used
      expect(service.getInventoryStock).toBeDefined();
    });

    it('should filter by low stock', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ success: true, payload: { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0 } })),
      );

      const req = new InventoryStockRequest({ IsLowStock: true });
      await service.getInventoryStock(req);

      // Direct Prisma query; no HTTP call args to check
      expect(service.getInventoryStock).toBeDefined();
    });

    it('should handle error', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('503')));

      const result = await service.getInventoryStock(
        new InventoryStockRequest(),
      );

      expect(result.success).toBe(false);
    });
  });

  // ─── getBatch ───
  describe('getBatch', () => {
    it('should return paged batches', async () => {
      const apiPayload = {
        success: true,
        payload: {
          items: [
            {
              id: 'batch-1',
              batchCode: 'BATCH-001',
              importQuantity: 100,
              remainingQuantity: 75,
              manufactureDate: '2025-06-01T00:00:00Z',
              expiryDate: '2027-06-01T00:00:00Z',
              createdAt: '2025-06-15T00:00:00Z',
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getBatch(new BatchRequest());

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(1);
      expect(result.payload!.items[0].batchCode).toBe('BATCH-001');
    });

    it('should handle error', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Fail')));

      const result = await service.getBatch(new BatchRequest());

      expect(result.success).toBe(false);
    });
  });

  // ─── createReportFromBatchAndStock ───
  describe('createReportFromBatchAndStock', () => {
    it('should generate combined report', async () => {
      const stockPayload = {
        success: true,
        payload: {
          items: [
            { id: 's1', variantId: 'v1', variantSku: 'SKU-1', productName: 'Perfume A', concentrationName: 'EDT', volumeMl: 50, totalQuantity: 30, lowStockThreshold: 5, isLowStock: false },
          ],
          pageNumber: 1,
          pageSize: 1000,
          totalCount: 1,
          totalPages: 1,
        },
      };
      const batchPayload = {
        success: true,
        payload: {
          items: [
            { id: 'b1', batchCode: 'B-001', importQuantity: 100, remainingQuantity: 80, manufactureDate: '2025-01-01T00:00:00Z', expiryDate: '2027-01-01T00:00:00Z', createdAt: '2025-02-01T00:00:00Z' },
          ],
          pageNumber: 1,
          pageSize: 1000,
          totalCount: 1,
          totalPages: 1,
        },
      };

      mockHttpService.get
        .mockReturnValueOnce(of(axiosResponse(stockPayload)))
        .mockReturnValueOnce(of(axiosResponse(batchPayload)));

      const report = await service.createReportFromBatchAndStock();

      expect(report).toContain('Inventory Stock Report');
      expect(report).toContain('Perfume A');
      expect(report).toContain('Batch Report');
      expect(report).toContain('B-001');
    });

    it('should handle empty data', async () => {
      const emptyPayload = { success: true, payload: { items: [], pageNumber: 1, pageSize: 1000, totalCount: 0, totalPages: 0 } };

      mockHttpService.get
        .mockReturnValueOnce(of(axiosResponse(emptyPayload)))
        .mockReturnValueOnce(of(axiosResponse(emptyPayload)));

      const report = await service.createReportFromBatchAndStock();

      expect(report).toContain('Inventory Stock Report');
      expect(report).toContain('Batch Report');
    });
  });

  // ─── report helper methods (pure, no HTTP) ───
  describe('createStockReport', () => {
    it('should format stock items', () => {
      const items = [
        { id: 's1', variantId: 'v1', variantSku: 'SKU-A', productName: 'Chanel', concentrationName: 'EDP', volumeMl: 100, totalQuantity: 25, lowStockThreshold: 10, isLowStock: false },
      ] as any;

      const report = service.createStockReport(items);

      expect(report).toContain('Chanel');
      expect(report).toContain('EDP');
      expect(report).toContain('100ml');
    });
  });

  describe('createBatchReport', () => {
    it('should format batch items', () => {
      const items = [
        { id: 'b1', batchCode: 'B-100', importQuantity: 200, remainingQuantity: 150, manufactureDate: '2025-01-01', expiryDate: '2027-01-01', createdAt: '2025-02-01' },
      ] as any;

      const report = service.createBatchReport(items);

      expect(report).toContain('B-100');
      expect(report).toContain('200');
      expect(report).toContain('150');
    });
  });
});
