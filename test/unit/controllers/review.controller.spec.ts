import { Test, TestingModule } from '@nestjs/testing';
import { ReviewController } from 'src/api/controllers/review.controller';
import { ReviewService } from 'src/infrastructure/servicies/review.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import {
  createMockReviewService,
  createMockAIService,
  createMockAdminInstructionService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  successResponseAPI,
  errorResponse,
  errorResponseAPI,
  TEST_VARIANT_ID,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('ReviewController', () => {
  let controller: ReviewController;
  let reviewService: ReturnType<typeof createMockReviewService>;
  let aiService: ReturnType<typeof createMockAIService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    reviewService = createMockReviewService();
    aiService = createMockAIService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        { provide: ReviewService, useValue: reviewService },
        { provide: AI_SERVICE, useValue: aiService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<ReviewController>(ReviewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /reviews ──────────
  describe('getReviews', () => {
    it('TC-FUNC-050: should return paginated reviews', async () => {
      const mockReviews = {
        items: [{ id: '1', rating: 5, content: 'Great' }],
        totalCount: 1,
      };
      reviewService.getAllReviews.mockResolvedValue(
        successResponseAPI(mockReviews),
      );

      const request = { PageNumber: 1, PageSize: 10 } as any;
      const result = await controller.getReviews(request);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(reviewService.getAllReviews).toHaveBeenCalledWith(request);
    });

    it('TC-FUNC-051: should return empty reviews', async () => {
      reviewService.getAllReviews.mockResolvedValue(
        successResponseAPI({ items: [], totalCount: 0 }),
      );

      const result = await controller.getReviews({} as any);

      expect(result.success).toBe(true);
      expect(result.payload!.items).toHaveLength(0);
    });
  });

  // ────────── GET /reviews/summary/:variantId ──────────
  describe('getReviewSummaryByVariantId', () => {
    it('TC-FUNC-052: should return AI-generated review summary', async () => {
      reviewService.getReviewsByVariantId.mockResolvedValue(
        successResponseAPI([
          { id: '1', rating: 5, content: 'Excellent fragrance' },
          { id: '2', rating: 4, content: 'Good value' },
        ]),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Overall positive reviews: excellent fragrance with good value.'),
      );

      const result = await controller.getReviewSummaryByVariantId(TEST_VARIANT_ID);

      expect(result.success).toBe(true);
      expect(result.data).toContain('positive');
    });

    it('TC-NEG-050: should return insufficient data when no reviews', async () => {
      reviewService.getReviewsByVariantId.mockResolvedValue(
        successResponseAPI([]),
      );

      const result = await controller.getReviewSummaryByVariantId(TEST_VARIANT_ID);

      expect(result.success).toBe(true);
      // Should return insufficient data message instead of calling AI
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });

    it('TC-NEG-051: should handle AI service failure', async () => {
      reviewService.getReviewsByVariantId.mockResolvedValue(
        successResponseAPI([{ id: '1', rating: 5, content: 'Good' }]),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('AI unavailable'),
      );

      const result = await controller.getReviewSummaryByVariantId(TEST_VARIANT_ID);

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /reviews/summary/structured/:variantId ──────────
  describe('getStructuredReviewSummaryByVariantId', () => {
    it('TC-FUNC-053: should return structured AI review summary', async () => {
      reviewService.getReviewsByVariantId.mockResolvedValue(
        successResponseAPI([
          { id: '1', rating: 5, content: 'Excellent' },
        ]),
      );
      reviewService.getReviewStatisticByVariantId.mockResolvedValue(
        successResponseAPI({ averageRating: 5, totalReviews: 1 }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse(JSON.stringify({ summary: 'Great product', sentiment: 'positive' })),
      );

      const result = await controller.getStructuredReviewSummaryByVariantId(TEST_VARIANT_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-052: should handle missing variant reviews gracefully', async () => {
      reviewService.getReviewsByVariantId.mockResolvedValue(
        successResponseAPI([]),
      );

      const result = await controller.getStructuredReviewSummaryByVariantId(TEST_VARIANT_ID);

      expect(result.success).toBe(true);
      // Should not call AI when no reviews
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });
  });
});
