import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ProductController } from 'src/api/controllers/product.controller';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

const mockHttpService = { get: jest.fn(), post: jest.fn() };

describe('ProductController (Integration – mock HTTP)', () => {
  let controller: ProductController;
  let service: ProductService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();
    service = module.get(ProductService);
    const mockUserLogService = { addSearchLogToUserLog: jest.fn() } as unknown as UserLogService;
    const mockAiAnalysisService = { analyze: jest.fn() } as unknown as any;
    controller = new ProductController(service, mockUserLogService, mockAiAnalysisService);
  });

  describe('getAllProducts', () => {
    it('should return paged products from API via controller', async () => {
      const apiData = {
        success: true,
        payload: {
          items: [{ id: '1', name: 'Perfume A' }],
          totalCount: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const request = new PagedAndSortedRequest();
      const result = await controller.getAllProducts(request);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should handle API error gracefully', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Network error')));

      const request = new PagedAndSortedRequest();
      const result = await controller.getAllProducts(request);

      expect(result.success).toBe(false);
    });
  });

  describe('getProductsBySemanticSearch', () => {
    it('should return search results via controller', async () => {
      const apiData = {
        success: true,
        payload: {
          items: [{ id: '1', name: 'Rose Perfume' }],
          totalCount: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const request = new SearchRequest();
      request.searchText = 'rose';
      const mockReq = { headers: {} } as any;
      const result = await controller.getProductsBySemanticSearch(mockReq, request);

      expect(result.success).toBe(true);
    });

    it('should handle empty search results', async () => {
      const apiData = {
        success: true,
        payload: { items: [], totalCount: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const request = new SearchRequest();
      request.searchText = 'nonexistent';
      const mockReq = { headers: {} } as any;
      const result = await controller.getProductsBySemanticSearch(mockReq, request);

      expect(result.success).toBe(true);
    });
  });
});
