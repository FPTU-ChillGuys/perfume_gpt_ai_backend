import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';

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

describe('ProfileService (integration – mock HTTP)', () => {
  let service: ProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get(ProfileService);
  });

  // ─── getOwnProfile ───
  describe('getOwnProfile', () => {
    it('should return profile from API', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        favoriteNotes: 'Rose, Jasmine',
        preferredStyle: 'Elegant',
        scentPreference: 'Floral',
        minBudget: 500000,
        maxBudget: 2000000,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      };
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ success: true, payload: profile })),
      );

      const result = await service.getOwnProfile('valid-token');

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.userId).toBe('user-1');
      expect(result.payload!.favoriteNotes).toBe('Rose, Jasmine');
    });

    it('should send Bearer token in headers', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ success: true, payload: {} })),
      );

      await service.getOwnProfile('my-secret-token');

      const callArgs = mockHttpService.get.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe('Bearer my-secret-token');
    });

    it('should handle API error gracefully', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('401 Unauthorized')),
      );

      const result = await service.getOwnProfile('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ─── createProfileReport ───
  describe('createProfileReport', () => {
    it('should generate a readable report from profile data', async () => {
      const profile = {
        id: 'p1',
        userId: 'u1',
        favoriteNotes: 'Sandalwood',
        preferredStyle: 'Casual',
        scentPreference: 'Woody',
        minBudget: 300000,
        maxBudget: 1000000,
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-02-01T10:00:00Z',
      };

      const report = await service.createProfileReport(profile as any);

      expect(report).toContain('u1');
      expect(report).toContain('Sandalwood');
      expect(report).toContain('Casual');
      expect(report).toContain('Woody');
      expect(report).toContain('300000');
      expect(report).toContain('1000000');
    });

    it('should handle missing optional fields', async () => {
      const report = await service.createProfileReport({
        id: 'p2',
        userId: 'u2',
        favoriteNotes: null,
        preferredStyle: null,
        scentPreference: null,
        minBudget: null,
        maxBudget: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      } as any);

      expect(report).toContain('Not specified');
    });

    it('should handle undefined profile', async () => {
      const report = await service.createProfileReport(undefined);

      expect(report).toContain('Not specified');
    });
  });

  // ─── createSystemPromptFromProfile ───
  describe('createSystemPromptFromProfile', () => {
    it('should build a system prompt containing profile info', async () => {
      const profile = {
        id: 'p1',
        userId: 'u1',
        favoriteNotes: 'Musk',
        preferredStyle: 'Sporty',
        scentPreference: 'Fresh',
        minBudget: 100000,
        maxBudget: 500000,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      };

      const prompt = await service.createSystemPromptFromProfile(profile as any);

      expect(prompt).toContain('profile information');
      expect(prompt).toContain('personalized perfume recommendations');
      expect(prompt).toContain('Musk');
      expect(prompt).toContain('Sporty');
    });

    it('should work with undefined profile', async () => {
      const prompt = await service.createSystemPromptFromProfile(undefined);

      expect(prompt).toContain('profile information');
    });
  });
});
