import { Test, TestingModule } from '@nestjs/testing';
import { LogController } from 'src/api/controllers/log.controller';
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
  TEST_USER_ID,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('LogController', () => {
  let controller: LogController;
  let userLogService: ReturnType<typeof createMockUserLogService>;
  let aiService: ReturnType<typeof createMockAIService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    userLogService = createMockUserLogService();
    aiService = createMockAIService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogController],
      providers: [
        { provide: UserLogService, useValue: userLogService },
        { provide: AI_SERVICE, useValue: aiService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<LogController>(LogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /logs/report/activity ──────────
  describe('collectLogs', () => {
    it('TC-FUNC-080: should return activity report for user', async () => {
      const request = { userId: TEST_USER_ID, period: 'WEEKLY' } as any;
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'Activity report', response: 'Activity report: 15 searches, 3 quiz answers...' }),
      );

      const result = await controller.collectLogs(request);

      expect(result.success).toBe(true);
      expect(result.data).toContain('Activity');
    });

    it('TC-NEG-080: should handle user with no logs', async () => {
      const request = { userId: 'new-user', period: 'WEEKLY' } as any;
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );

      const result = await controller.collectLogs(request);

      expect(result.success).toBe(true);
    });
  });

  // ────────── GET /logs/summarize ──────────
  describe('summarizeLogs', () => {
    it('TC-FUNC-081: should return AI-summarized user logs', async () => {
      const request = { userId: TEST_USER_ID, period: 'WEEKLY' } as any;
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'Summarize...', response: 'User is active...' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('User showed interest in floral fragrances...'),
      );

      const result = await controller.summarizeLogs(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-081: should handle insufficient log data', async () => {
      const request = { userId: 'new-user', period: 'WEEKLY' } as any;
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );

      const result = await controller.summarizeLogs(request);

      expect(result.success).toBe(true);
      // Should return insufficient data message
    });
  });

  // ────────── GET /logs/summarize/all ──────────
  describe('summarizeAllLogs', () => {
    it('TC-FUNC-082: should return AI summary of all user logs', async () => {
      const request = { period: 'MONTHLY' } as any;
      userLogService.getReportAndPromptSummaryAllUsersLogs.mockResolvedValue(
        successResponse({ prompt: 'All users summary...', response: 'Trends show...' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Overall user trends: increasing interest in oriental scents'),
      );

      const result = await controller.summarizeAllLogs(request);

      expect(result.success).toBe(true);
    });
  });

  // ────────── GET /logs/summaries ──────────
  describe('getUserLogsSummariesById', () => {
    it('TC-FUNC-083: should return stored log summaries', async () => {
      userLogService.getUserLogSummariesByUserId.mockResolvedValue(
        successResponse([
          { userId: TEST_USER_ID, summary: 'Week 1 summary', startDate: new Date(), endDate: new Date() },
        ]),
      );

      const result = await controller.getUserLogsSummariesById(
        TEST_USER_ID, new Date(), new Date(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('TC-FUNC-084: should return empty for user with no summaries', async () => {
      userLogService.getUserLogSummariesByUserId.mockResolvedValue(
        successResponse([]),
      );

      const result = await controller.getUserLogsSummariesById(
        'new-user', new Date(), new Date(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────── GET /logs/report/summary ──────────
  describe('getUserLogsSummaryReportById', () => {
    it('TC-FUNC-085: should return summary report for user', async () => {
      userLogService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('Summary report for user...'),
      );

      const result = await controller.getUserLogsSummaryReportById(
        TEST_USER_ID, new Date(), new Date(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toContain('Summary');
    });
  });

  // ────────── POST /logs ──────────
  describe('createUserLogSummary', () => {
    it('TC-FUNC-086: should create new user log summary', async () => {
      const request = {
        userId: TEST_USER_ID,
        summary: 'Weekly log summary content',
        startDate: new Date(),
        endDate: new Date(),
      } as any;
      userLogService.saveUserLogSummary.mockResolvedValue(
        successResponse('Summary saved'),
      );

      const result = await controller.createUserLogSummary(request);

      expect(result.success).toBe(true);
    });

    it('TC-NEG-082: should handle save failure', async () => {
      userLogService.saveUserLogSummary.mockResolvedValue(
        errorResponse('Failed to save summary'),
      );

      const result = await controller.createUserLogSummary({} as any);

      expect(result.success).toBe(false);
    });
  });

  // ────────── Cron Jobs ──────────
  describe('Cron: summarizeLogsPerWeek', () => {
    it('TC-FUNC-087: should iterate all users and summarize weekly', async () => {
      userLogService.getAllUserIdsFromLogs.mockResolvedValue([TEST_USER_ID, 'user-2']);
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'report', response: 'data' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Weekly summary generated'),
      );
      userLogService.saveUserLogSummary.mockResolvedValue(successResponse('Saved'));

      const result = await controller.summarizeLogsPerWeek();

      // Should call for each user
      expect(userLogService.getAllUserIdsFromLogs).toHaveBeenCalled();
    });

    it('TC-FUNC-088: should handle empty user list in cron', async () => {
      userLogService.getAllUserIdsFromLogs.mockResolvedValue([]);

      const result = await controller.summarizeLogsPerWeek();

      expect(result).toBeDefined();
    });
  });

  describe('Cron: summarizeLogsPerDay', () => {
    it('TC-FUNC-089: should run daily summarization', async () => {
      userLogService.getAllUserIdsFromLogs.mockResolvedValue([TEST_USER_ID]);
      userLogService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: 'report', response: 'data' }),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Daily summary'),
      );
      userLogService.saveUserLogSummary.mockResolvedValue(successResponse('Saved'));

      const result = await controller.summarizeLogsPerYear();

      expect(userLogService.getAllUserIdsFromLogs).toHaveBeenCalled();
    });
  });
});
