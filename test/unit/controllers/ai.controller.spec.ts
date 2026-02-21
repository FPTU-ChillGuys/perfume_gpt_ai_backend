import { Test, TestingModule } from '@nestjs/testing';
import { AIController } from 'src/api/controllers/ai/ai.controller';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { createMockAIService, createMockUserLogService } from '../../helpers/mock-factories';
import { successResponse, errorResponse, createMockRequest } from '../../helpers/test-constants';

describe('AIController', () => {
  let controller: AIController;
  let aiService: ReturnType<typeof createMockAIService>;

  beforeEach(async () => {
    aiService = createMockAIService();
    const userLogService = createMockUserLogService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        { provide: AI_SERVICE, useValue: aiService },
        { provide: UserLogService, useValue: userLogService },
      ],
    }).compile();

    controller = module.get<AIController>(AIController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── POST /ai/search ──────────
  describe('searchProductWithAI', () => {
    it('TC-FUNC-001: should return AI-generated result for valid prompt', async () => {
      const prompt = 'Tìm nước hoa cho mùa hè';
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Nước hoa citrus phù hợp mùa hè...'),
      );

      const result = await controller.searchProductWithAI(createMockRequest(), prompt);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(aiService.textGenerateFromPrompt).toHaveBeenCalledWith(prompt);
    });

    it('TC-NEG-001: should handle empty prompt gracefully', async () => {
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse(''),
      );

      const result = await controller.searchProductWithAI(createMockRequest(), '');

      expect(result.success).toBe(true);
      expect(aiService.textGenerateFromPrompt).toHaveBeenCalled();
    });

    it('TC-NEG-002: should handle AI service error', async () => {
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('AI service unavailable'),
      );

      const result = await controller.searchProductWithAI(createMockRequest(), 'test query');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('TC-NEG-003: should handle AI service throwing exception', async () => {
      aiService.textGenerateFromPrompt.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(controller.searchProductWithAI(createMockRequest(), 'test'))
        .rejects.toThrow('Connection timeout');
    });

    it('TC-FUNC-002: should pass prompt to AI service correctly', async () => {
      const prompt = 'Dior Sauvage review';
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Dior Sauvage là...'),
      );

      await controller.searchProductWithAI(createMockRequest(), prompt);

      expect(aiService.textGenerateFromPrompt).toHaveBeenCalledTimes(1);
      const calledPrompt = aiService.textGenerateFromPrompt.mock.calls[0][0];
      expect(calledPrompt).toContain(prompt);
    });
  });
});
