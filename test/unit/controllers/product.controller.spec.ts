import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from 'src/api/controllers/product.controller';
import { ProductService } from 'src/infrastructure/servicies/product.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { createMockProductService, createMockUserLogService } from '../../helpers/mock-factories';
import { successResponseAPI, errorResponseAPI, createMockRequest } from '../../helpers/test-constants';

describe('ProductController', () => {
  let controller: ProductController;
  let productService: ReturnType<typeof createMockProductService>;
  let userLogService: ReturnType<typeof createMockUserLogService>;

  beforeEach(async () => {
    productService = createMockProductService();
    userLogService = createMockUserLogService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: UserLogService, useValue: userLogService }
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /products ──────────
  describe('getAllProducts', () => {
    const pagedRequest = { PageNumber: 1, PageSize: 10 } as any;

    it('TC-FUNC-010: should return paginated product list', async () => {
      const mockProducts = {
        items: [{ id: '1', name: 'Dior Sauvage' }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 10,
      };
      productService.getAllProducts.mockResolvedValue(
        successResponseAPI(mockProducts),
      );

      const result = await controller.getAllProducts(pagedRequest);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.items).toHaveLength(1);
      expect(productService.getAllProducts).toHaveBeenCalledWith(pagedRequest);
    });

    it('TC-FUNC-011: should return empty list when no products', async () => {
      productService.getAllProducts.mockResolvedValue(
        successResponseAPI({ items: [], totalCount: 0 }),
      );

      const result = await controller.getAllProducts(pagedRequest);

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(0);
    });

    it('TC-NEG-010: should handle service error', async () => {
      productService.getAllProducts.mockResolvedValue(
        errorResponseAPI('Product service unavailable'),
      );

      const result = await controller.getAllProducts(pagedRequest);

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /products/search ──────────
  describe('getProductsBySemanticSearch', () => {
    const searchRequest = { searchText: 'Chanel', PageNumber: 1, PageSize: 10 } as any;

    it('TC-FUNC-012: should return matching products for search query', async () => {
      const mockProducts = {
        items: [{ id: '1', name: 'Chanel No.5' }],
        totalCount: 1,
      };
      productService.getProductsUsingSemanticSearch.mockResolvedValue(
        successResponseAPI(mockProducts),
      );

      const result = await controller.getProductsBySemanticSearch(
        createMockRequest(), searchRequest,
      );

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(1);
      expect(productService.getProductsUsingSemanticSearch)
        .toHaveBeenCalledWith('Chanel', searchRequest);
    });

    it('TC-FUNC-013: should return empty for no matching products', async () => {
      productService.getProductsUsingSemanticSearch.mockResolvedValue(
        successResponseAPI({ items: [], totalCount: 0 }),
      );

      const result = await controller.getProductsBySemanticSearch(
        createMockRequest(), { ...searchRequest, searchText: 'xyz-nonexistent' },
      );

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(0);
    });

    it('TC-NEG-011: should handle search with special characters', async () => {
      productService.getProductsUsingSemanticSearch.mockResolvedValue(
        successResponseAPI({ items: [], totalCount: 0 }),
      );

      const result = await controller.getProductsBySemanticSearch(
        createMockRequest(), { ...searchRequest, searchText: '<script>alert("xss")</script>' },
      );

      expect(result.success).toBe(true);
    });
  });
});
