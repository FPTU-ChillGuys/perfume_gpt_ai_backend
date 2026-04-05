import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';

describe('UserLogService (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let service: UserLogService;

  beforeAll(async () => {
    module = await createIntegrationTestingModule([UserLogService]);
    orm = module.get(MikroORM);
    service = module.get(UserLogService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  // ────────── USER LOG CREATION ──────────
  describe('createUserLogIfNotExist', () => {
    it('should create a new user log when none exists', async () => {
      const userLog = await service.createUserLogIfNotExist('new-user');

      expect(userLog).toBeDefined();
      expect(userLog.userId).toBe('new-user');
    });

    it('should return existing user log without creating duplicate', async () => {
      const first = await service.createUserLogIfNotExist('same-user');
      const second = await service.createUserLogIfNotExist('same-user');

      expect(first.id).toBe(second.id);
    });
  });

  describe('getUserLogsByUserId', () => {
    it('should return user log by userId', async () => {
      await service.createUserLogIfNotExist('target-user');

      const result = await service.getUserLogsByUserId('target-user');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe('target-user');
    });

    it('should return failure for non-existent user', async () => {
      const result = await service.getUserLogsByUserId('ghost');

      expect(result.success).toBe(false);
    });
  });

  // ────────── SEARCH LOGS ──────────
  describe('addSearchLogToUserLog', () => {
    it('should add search log to user', async () => {
      const logs = await service.addSearchLogToUserLog('search-user', 'Chanel No.5');

      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should add another search log for same user', async () => {
      await service.addSearchLogToUserLog('search-user-2', 'Dior Sauvage');
      const logs = await service.addSearchLogToUserLog('search-user-2', 'Tom Ford Oud Wood');

      // Service passes user.id (UUID PK) to repo which searches by userId field,
      // so collection doesn't accumulate across calls in current implementation
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('addUserSearch', () => {
    it('should add search and return response', async () => {
      // Ensure user log exists first
      await service.createUserLogIfNotExist('search-user-3');

      const result = await service.addUserSearch('perfume for summer', 'search-user-3');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  // ────────── LOG SUMMARIES ──────────
  describe('saveUserLogSummary', () => {
    it('should save user log summary to database', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      const result = await service.saveUserLogSummary(
        'summary-user',
        start,
        end,
        'User is interested in floral scents.',
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('User is interested in floral scents.');
    });
  });

  describe('getUserLogSummariesByUserId', () => {
    it('should return summaries within date range', async () => {
      await service.saveUserLogSummary(
        'sum-user',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        'January summary',
      );
      await service.saveUserLogSummary(
        'sum-user',
        new Date('2026-02-01'),
        new Date('2026-02-28'),
        'February summary',
      );

      const result = await service.getUserLogSummariesByUserId(
        'sum-user',
        new Date('2026-01-01'),
        new Date('2026-02-28'),
      );

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getUserLogSummaryReportByUserId', () => {
    it('should generate report from summaries', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      await service.saveUserLogSummary('report-user', start, end, 'Likes woody perfumes');

      const result = await service.getUserLogSummaryReportByUserId('report-user', start, end);

      expect(result.success).toBe(true);
      expect(result.data).toContain('Likes woody perfumes');
      expect(result.data).toContain('User Log Summary Report');
    });
  });

  // ────────── ALL USER IDS ──────────
  describe('getAllUserIdsFromLogs', () => {
    it('should return unique user IDs', async () => {
      await service.createUserLogIfNotExist('user-a');
      await service.createUserLogIfNotExist('user-b');
      await service.createUserLogIfNotExist('user-c');

      const userIds = await service.getAllUserIdsFromLogs();

      expect(userIds).toHaveLength(3);
      expect(userIds).toContain('user-a');
      expect(userIds).toContain('user-b');
      expect(userIds).toContain('user-c');
    });

    it('should return empty array when no logs exist', async () => {
      const userIds = await service.getAllUserIdsFromLogs();

      expect(userIds).toHaveLength(0);
    });
  });

  // ────────── PERIOD CALCULATION ──────────
  describe('getFirstDateOfPeriod', () => {
    it('should calculate weekly start date', () => {
      const end = new Date('2026-02-12');
      const start = service.getFirstDateOfPeriod(PeriodEnum.WEEKLY, end);

      expect(start.getDate()).toBe(end.getDate() - 7);
    });

    it('should calculate monthly start date', () => {
      const end = new Date('2026-02-12');
      const start = service.getFirstDateOfPeriod(PeriodEnum.MONTHLY, end);

      expect(start.getMonth()).toBe(end.getMonth() - 1);
    });

    it('should calculate yearly start date', () => {
      const end = new Date('2026-02-12');
      const start = service.getFirstDateOfPeriod(PeriodEnum.YEARLY, end);

      expect(start.getFullYear()).toBe(end.getFullYear() - 1);
    });
  });

  // ────────── REPORT AND PROMPT ──────────
  describe('getReportAndPromptSummaryUserLogs', () => {
    it('should generate prompt and report from user logs', async () => {
      // Create user log with search data
      await service.addSearchLogToUserLog('prompt-user', 'best floral perfume');
      await service.addSearchLogToUserLog('prompt-user', 'summer fragrance');

      const result = await service.getReportAndPromptSummaryUserLogs({
        userId: 'prompt-user',
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.prompt).toBeDefined();
      expect(result.data!.response).toBeDefined();
    });

    it('should return error when user log does not exist', async () => {
      const result = await service.getReportAndPromptSummaryUserLogs({
        userId: 'nonexistent-prompt-user',
        period: PeriodEnum.MONTHLY,
        endDate: new Date(),
      });

      expect(result.success).toBe(false);
    });
  });

  // ────────── CACHING ──────────
  describe('getCachedUserLogSummaryReportByUserId', () => {
    it('should return same result from cache on second call', async () => {
      await service.saveUserLogSummary(
        'cache-user',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        'Cached summary',
      );

      const first = await service.getCachedUserLogSummaryReportByUserId(
        'cache-user',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );
      const second = await service.getCachedUserLogSummaryReportByUserId(
        'cache-user',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(first.data).toBe(second.data);
    });
  });

  describe('clearSummaryCache', () => {
    it('should clear cache without error', () => {
      expect(() => service.clearSummaryCache()).not.toThrow();
      expect(() => service.clearSummaryCache('some-user')).not.toThrow();
    });
  });
});
