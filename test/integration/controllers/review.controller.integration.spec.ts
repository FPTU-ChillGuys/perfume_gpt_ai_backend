import { MikroORM } from '@mikro-orm/core';
import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ReviewController } from 'src/api/controllers/review.controller';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { AIService } from 'src/infrastructure/domain/ai/ai.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';

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

describe('ReviewController (Integration)', () => {
  let dbModule: TestingModule;
  let orm: MikroORM;
  let controller: ReviewController;
  let reviewService: ReviewService;
  let adminInstructionService: AdminInstructionService;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
  } as unknown as AIService;

  beforeAll(async () => {
    dbModule = await createIntegrationTestingModule([
      AdminInstructionService,
      ReviewService,
      { provide: HttpService, useValue: mockHttpService },
    ]);
    orm = dbModule.get(MikroORM);
    adminInstructionService = dbModule.get(AdminInstructionService);
    reviewService = dbModule.get(ReviewService);

    controller = new ReviewController(reviewService, mockAIService, adminInstructionService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await orm.close(true);
    await dbModule.close();
  });

  describe('getReviews', () => {
    it('should return paged reviews from external API', async () => {
      const apiData = {
        success: true,
        payload: {
          items: [{ id: '1', commentPreview: 'Great perfume!', rating: 5 }],
          totalCount: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const result = await controller.getReviews({} as any);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should handle API failure', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Error')));

      const result = await controller.getReviews({} as any);

      expect(result.success).toBe(false);
    });
  });

  describe('getReviewSummaryByVariantId', () => {
    it('should return insufficient data when no reviews', async () => {
      const apiData = {
        success: true,
        payload: [],
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const result = await controller.getReviewSummaryByVariantId('variant-1');

      expect(result.success).toBe(true);
      // Should get insufficient data message
    });

    it('should generate AI summary when reviews exist', async () => {
      const apiData = {
        success: true,
        payload: [
          { id: '1', comment: 'Lovely floral scent', rating: 5 },
          { id: '2', comment: 'Too strong for me', rating: 2 },
        ],
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'Mixed reviews - generally positive floral scent',
      });

      const result = await controller.getReviewSummaryByVariantId('variant-1');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Mixed reviews - generally positive floral scent');
      expect(mockAIService.textGenerateFromPrompt).toHaveBeenCalled();
    });

    it('should handle AI failure', async () => {
      const apiData = {
        success: true,
        payload: [{ id: '1', comment: 'Good', rating: 4 }],
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: false,
        error: 'AI error',
      });

      const result = await controller.getReviewSummaryByVariantId('variant-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get AI summary response');
    });
  });

  describe('getStructuredReviewSummaryByVariantId', () => {
    it('should return structured response with metadata for empty reviews', async () => {
      const apiData = {
        success: true,
        payload: [],
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      const result = await controller.getStructuredReviewSummaryByVariantId('variant-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.variantId).toBe('variant-1');
      expect(result.data!.reviewCount).toBe(0);
    });

    it('should return structured AI summary with review count', async () => {
      const apiData = {
        success: true,
        payload: [
          { id: '1', comment: 'Amazing!', rating: 5 },
          { id: '2', comment: 'Good value', rating: 4 },
        ],
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiData)));

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'Highly rated perfume',
      });

      const result = await controller.getStructuredReviewSummaryByVariantId('variant-1');

      expect(result.success).toBe(true);
      expect(result.data!.reviewCount).toBe(2);
      expect(result.data!.summary).toBe('Highly rated perfume');
      expect(result.data!.metadata).toBeDefined();
    });
  });
});
