import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ProfileController } from 'src/api/controllers/profile.controller';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { Request } from 'express';

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

const mockHttpService = { get: jest.fn(), post: jest.fn() };

function mockRequest(token = 'test-token'): Request {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

describe('ProfileController (Integration – mock HTTP)', () => {
  let controller: ProfileController;
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
    controller = new ProfileController(service);
  });

  describe('getOwnProfile', () => {
    it('should return profile from external API via controller', async () => {
      const profileData = {
        success: true,
        payload: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(profileData)));

      const result = await controller.getOwnProfile(mockRequest());

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should handle API failure', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Unauthorized')));

      const result = await controller.getOwnProfile(mockRequest());

      expect(result.success).toBe(false);
    });
  });

  describe('getProfileReport', () => {
    it('should return profile report text', async () => {
      const profileData = {
        success: true,
        payload: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
      };
      mockHttpService.get.mockReturnValue(of(axiosResponse(profileData)));

      const result = await controller.getProfileReport(mockRequest());

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    it('should handle failed profile fetch', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Error')));

      const result = await controller.getProfileReport(mockRequest());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch profile');
    });
  });
});
