import { Test, TestingModule } from '@nestjs/testing';
import { TrendController } from 'src/api/controllers/trend.controller';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { AI_SERVICE } from 'src/infrastructure/domain/ai/ai.module';
import {
  createMockUserLogService,
  createMockAIService,
  createMockAdminInstructionService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  errorResponse,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('TrendController', () => {
  let controller: TrendController;
  let userLogService: ReturnType<typeof createMockUserLogService>;
  let aiService: ReturnType<typeof createMockAIService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    userLogService = createMockUserLogService();
    aiService = createMockAIService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrendController],
      providers: [
        { provide: UserLogService, useValue: userLogService },
        { provide: AI_SERVICE, useValue: aiService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<TrendController>(TrendController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── POST /trends/summary ──────────
  describe('summarizeLogs', () => {
    it('TC-FUNC-120: should return trend summary from all user logs', async () => {
      const request = { period: 'MONTHLY', endDate: new Date() } as any;
      userLogService.getReportAndPromptSummaryAllUsersLogs.mockResolvedValue(
        successResponse({ prompt: 'User trends data...', response: 'Floral trending up' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Trend analysis: Floral fragrances are trending in Q1 2025...'),
      );

      const result = await controller.summarizeLogs(request);

      expect(result.success).toBe(true);
      expect(result.data).toContain('Trend');
    });

    it('TC-NEG-120: should handle insufficient trend data', async () => {
      const request = { period: 'WEEKLY', endDate: new Date() } as any;
      userLogService.getReportAndPromptSummaryAllUsersLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );

      const result = await controller.summarizeLogs(request);

      expect(result.success).toBe(true);
      // Should return insufficient data message
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });

    it('TC-NEG-121: should handle AI service error', async () => {
      const request = { period: 'MONTHLY', endDate: new Date() } as any;
      userLogService.getReportAndPromptSummaryAllUsersLogs.mockResolvedValue(
        successResponse({ prompt: 'data', response: 'report' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('AI unavailable'),
      );

      const result = await controller.summarizeLogs(request);

      expect(result.success).toBe(false);
    });
  });

  // ────────── POST /trends/summary/structured ──────────
  describe('summarizeLogsStructured', () => {
    it('TC-FUNC-121: should return structured trend forecast', async () => {
      const request = { period: 'MONTHLY', endDate: new Date() } as any;
      userLogService.getReportAndPromptSummaryAllUsersLogs.mockResolvedValue(
        successResponse({ prompt: 'data', response: 'report' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse(JSON.stringify({
          trendingCategories: ['Floral', 'Oriental'],
          forecast: 'Increasing demand',
        })),
      );

      const result = await controller.summarizeLogsStructured(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-122: should handle empty data for structured endpoint', async () => {
      const request = { period: 'WEEKLY', endDate: new Date() } as any;
      userLogService.getReportAndPromptSummaryAllUsersLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );

      const result = await controller.summarizeLogsStructured(request);

      expect(result.success).toBe(true);
      expect(aiService.textGenerateFromPrompt).not.toHaveBeenCalled();
    });
  });
});
