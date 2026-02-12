import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';

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

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

describe('ProductService (integration – mock HTTP)', () => {
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
  });

  // ─── getAllProducts ───
  describe('getAllProducts', () => {
    it('should return paged products from API', async () => {
      const apiPayload = {
        success: true,
        payload: {
          items: [
            {
              id: 'p1',
              name: 'Chanel No.5',
              brandId: 1,
              brandName: 'Chanel',
              categoryId: 1,
              categoryName: 'Perfume',
              description: 'Classic fragrance',
              primaryImage: null,
              attributes: [],
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getAllProducts(new PagedAndSortedRequest());

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.items).toHaveLength(1);
      expect(result.payload!.items[0].name).toBe('Chanel No.5');
      expect(mockHttpService.get).toHaveBeenCalledTimes(1);
    });

    it('should use pagination params correctly', async () => {
      const apiPayload = {
        success: true,
        payload: { items: [], pageNumber: 2, pageSize: 5, totalCount: 0, totalPages: 0 },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const req = new PagedAndSortedRequest();
      req.PageNumber = 2;
      req.PageSize = 5;
      req.SortBy = 'name';
      req.SortOrder = 'desc';

      await service.getAllProducts(req);

      const callArgs = mockHttpService.get.mock.calls[0];
      expect(callArgs[1].params.pageNumber).toBe(2);
      expect(callArgs[1].params.pageSize).toBe(5);
      expect(callArgs[1].params.sortBy).toBe('name');
      expect(callArgs[1].params.sortOrder).toBe('desc');
    });

    it('should handle API error gracefully', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Network failure')));

      const result = await service.getAllProducts(new PagedAndSortedRequest());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ─── getProductsUsingSemanticSearch ───
  describe('getProductsUsingSemanticSearch', () => {
    it('should return search results', async () => {
      const apiPayload = {
        success: true,
        payload: {
          items: [
            {
              id: 'p2',
              name: 'Dior Sauvage',
              brandId: 2,
              brandName: 'Dior',
              categoryId: 1,
              categoryName: 'Perfume',
              description: 'Wild scent',
              primaryImage: 'https://img.example.com/sauvage.jpg',
              attributes: [{ id: 'a1', attributeId: 1, valueId: 1, attribute: 'Weather', description: '', value: 'Summer' }],
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getProductsUsingSemanticSearch('woody fragrance', new PagedAndSortedRequest());

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(1);
      expect(result.payload!.items[0].name).toBe('Dior Sauvage');
    });

    it('should pass searchText param', async () => {
      mockHttpService.get.mockReturnValue(of(axiosResponse({ success: true, payload: { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0 } })));

      await service.getProductsUsingSemanticSearch('floral notes', new PagedAndSortedRequest());

      const callArgs = mockHttpService.get.mock.calls[0];
      expect(callArgs[1].params.searchText).toBe('floral notes');
    });

    it('should handle empty results', async () => {
      mockHttpService.get.mockReturnValue(of(axiosResponse({
        success: true,
        payload: { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0 },
      })));

      const result = await service.getProductsUsingSemanticSearch('nonexistent', new PagedAndSortedRequest());

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(0);
    });

    it('should handle API failure', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Timeout')));

      const result = await service.getProductsUsingSemanticSearch('test', new PagedAndSortedRequest());

      expect(result.success).toBe(false);
    });
  });
});
