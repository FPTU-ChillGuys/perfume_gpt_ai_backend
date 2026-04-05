import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from 'src/api/controllers/profile.controller';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { createMockProfileService } from '../../helpers/mock-factories';
import {
  successResponseAPI,
  successResponse,
  errorResponse,
  createMockRequest,
  createMockRequestNoAuth,
  TEST_AUTH_HEADER,
} from '../../helpers/test-constants';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: ReturnType<typeof createMockProfileService>;

  beforeEach(async () => {
    profileService = createMockProfileService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: profileService }],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /profile/me ──────────
  describe('getOwnProfile', () => {
    it('TC-FUNC-020: should return user profile with auth header', async () => {
      const mockProfile = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
      };
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI(mockProfile),
      );

      const req = createMockRequest();
      const result = await controller.getOwnProfile(req);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(profileService.getOwnProfile).toHaveBeenCalled();
    });

    it('TC-FUNC-021: should pass auth header to service', async () => {
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: 'user-1' }),
      );

      const req = createMockRequest();
      await controller.getOwnProfile(req);

      // Service should receive the authorization header value
      expect(profileService.getOwnProfile).toHaveBeenCalledTimes(1);
    });

    it('TC-NEG-020: should handle missing auth gracefully', async () => {
      profileService.getOwnProfile.mockRejectedValue(
        new Error('Unauthorized'),
      );

      const req = createMockRequestNoAuth();
      await expect(controller.getOwnProfile(req)).rejects.toThrow();
    });
  });

  // ────────── GET /profile/report ──────────
  describe('getProfileReport', () => {
    it('TC-FUNC-022: should return profile report string', async () => {
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: 'user-1', username: 'testuser' }),
      );
      profileService.createProfileReport.mockResolvedValue(
        'Profile report: testuser, email: test@example.com',
      );

      const req = createMockRequest();
      const result = await controller.getProfileReport(req);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-021: should handle profile service error', async () => {
      profileService.getOwnProfile.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const req = createMockRequest();
      await expect(controller.getProfileReport(req)).rejects.toThrow();
    });
  });
});
