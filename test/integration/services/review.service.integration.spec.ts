import { MikroORM } from '@mikro-orm/core';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ReviewService } from 'src/infrastructure/servicies/review.service';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';

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

const mockHttpService = { get: jest.fn() };

describe('ReviewService (integration – DB + mock HTTP)', () => {
  let service: ReviewService;
  let orm: MikroORM;

  beforeAll(async () => {
    const module = await createIntegrationTestingModule([
      ReviewService,
      { provide: HttpService, useValue: mockHttpService },
    ]);

    orm = module.get(MikroORM);
    service = module.get(ReviewService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  // ─── getAllReviews ───
  describe('getAllReviews', () => {
    it('should return paged reviews from external API', async () => {
      const apiPayload = {
        success: true,
        payload: {
          items: [
            {
              id: 'rev-1',
              userId: 'u1',
              userFullName: 'Alice',
              userProfilePictureUrl: null,
              variantId: 'v1',
              variantName: 'Chanel No.5 100ml',
              rating: 5,
              commentPreview: 'Amazing scent!',
              status: 'Approved',
              imageCount: 2,
              createdAt: '2026-01-15T00:00:00Z',
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getAllReviews(new GetPagedReviewRequest());

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(1);
      expect(result.payload!.items[0].rating).toBe(5);
    });

    it('should pass filter params', async () => {
      const emptyPayload = { success: true, payload: { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0 } };
      mockHttpService.get.mockReturnValue(of(axiosResponse(emptyPayload)));

      const req = new GetPagedReviewRequest();
      (req as any).VariantId = 'v-abc';
      (req as any).MinRating = 4;
      (req as any).MaxRating = 5;
      (req as any).Status = 'Approved';
      (req as any).HasImages = true;

      await service.getAllReviews(req);

      const callArgs = mockHttpService.get.mock.calls[0];
      expect(callArgs[1].params.variantId).toBe('v-abc');
      expect(callArgs[1].params.minRating).toBe(4);
      expect(callArgs[1].params.maxRating).toBe(5);
      expect(callArgs[1].params.status).toBe('Approved');
      expect(callArgs[1].params.hasImages).toBe(true);
    });

    it('should handle API error', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Down')),
      );

      const result = await service.getAllReviews(new GetPagedReviewRequest());

      expect(result.success).toBe(false);
    });
  });

  // ─── getReviewsByVariantId ───
  describe('getReviewsByVariantId', () => {
    it('should return reviews for a variant', async () => {
      const apiPayload = {
        success: true,
        payload: [
          {
            id: 'rev-1',
            userId: 'u1',
            userFullName: 'Bob',
            userProfilePictureUrl: null,
            orderDetailId: 'od1',
            variantId: 'v-100',
            variantName: 'Dior Sauvage 50ml',
            rating: 4,
            comment: 'Good scent, long lasting',
            status: 'Approved',
            images: [],
            createdAt: '2026-02-01T00:00:00Z',
            updatedAt: null,
          },
        ],
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getReviewsByVariantId('v-100');

      expect(result.success).toBe(true);
      expect(result.payload).toHaveLength(1);
      expect(result.payload![0].variantName).toBe('Dior Sauvage 50ml');
    });

    it('should handle empty result', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ success: true, payload: [] })),
      );

      const result = await service.getReviewsByVariantId('no-reviews');

      expect(result.success).toBe(true);
      expect(result.payload).toHaveLength(0);
    });
  });

  // ─── getReviewStatisticByVariantId ───
  describe('getReviewStatisticByVariantId', () => {
    it('should return review statistics', async () => {
      const apiPayload = {
        success: true,
        payload: {
          variantId: 'v-stat',
          totalReviews: 100,
          averageRating: 4.3,
          fiveStarCount: 50,
          fourStarCount: 25,
          threeStarCount: 15,
          twoStarCount: 5,
          oneStarCount: 5,
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(apiPayload)));

      const result = await service.getReviewStatisticByVariantId('v-stat');

      expect(result.success).toBe(true);
      expect(result.payload!.totalReviews).toBe(100);
      expect(result.payload!.averageRating).toBe(4.3);
      expect(result.payload!.fiveStarCount).toBe(50);
    });

    it('should handle API failure', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('500 Internal')),
      );

      const result = await service.getReviewStatisticByVariantId('v-fail');

      expect(result.success).toBe(false);
    });
  });
});
