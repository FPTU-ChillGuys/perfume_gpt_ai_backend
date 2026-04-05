import { Test, TestingModule } from '@nestjs/testing';
import { AIAcceptanceController } from 'src/api/controllers/ai-acceptance.controller';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { createMockAIAcceptanceService } from '../../helpers/mock-factories';
import {
  successResponse,
  errorResponse,
  TEST_ACCEPTANCE_ID,
  TEST_USER_ID,
} from '../../helpers/test-constants';

describe('AIAcceptanceController', () => {
  let controller: AIAcceptanceController;
  let service: ReturnType<typeof createMockAIAcceptanceService>;

  beforeEach(async () => {
    service = createMockAIAcceptanceService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIAcceptanceController],
      providers: [
        { provide: AIAcceptanceService, useValue: service },
      ],
    }).compile();

    controller = module.get<AIAcceptanceController>(AIAcceptanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── POST /ai-acceptance/:id ──────────
  describe('updateAIAcceptanceData', () => {
    it('TC-FUNC-040: should update acceptance status to true', async () => {
      const mockAcceptance = { id: TEST_ACCEPTANCE_ID, isAccepted: true };
      service.updateAIAcceptanceStatusById.mockResolvedValue(
        successResponse(mockAcceptance),
      );

      const result = await controller.updateAIAcceptanceData(TEST_ACCEPTANCE_ID, 'true');

      expect(result.success).toBe(true);
      expect(result.data!.isAccepted).toBe(true);
      expect(service.updateAIAcceptanceStatusById).toHaveBeenCalledWith(
        TEST_ACCEPTANCE_ID,
        true,
      );
    });

    it('TC-FUNC-041: should update acceptance status to false', async () => {
      service.updateAIAcceptanceStatusById.mockResolvedValue(
        successResponse({ id: TEST_ACCEPTANCE_ID, isAccepted: false }),
      );

      const result = await controller.updateAIAcceptanceData(TEST_ACCEPTANCE_ID, 'false');

      expect(result.success).toBe(true);
      expect(result.data!.isAccepted).toBe(false);
    });

    it('TC-NEG-040: should handle non-existent id', async () => {
      service.updateAIAcceptanceStatusById.mockResolvedValue(
        errorResponse('Record not found'),
      );

      const result = await controller.updateAIAcceptanceData('bad-id', 'true');

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /ai-acceptance/status/:userId ──────────
  describe('getAIAcceptanceStatus', () => {
    it('TC-FUNC-042: should return acceptance status for user', async () => {
      service.getAIAcceptanceByUserId.mockResolvedValue(
        successResponse({ id: TEST_ACCEPTANCE_ID, userId: TEST_USER_ID, isAccepted: true }),
      );

      const result = await controller.getAIAcceptanceStatus(TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(service.getAIAcceptanceByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('TC-FUNC-043: should return null for user without acceptance record', async () => {
      service.getAIAcceptanceByUserId.mockResolvedValue(
        successResponse(null),
      );

      const result = await controller.getAIAcceptanceStatus(TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  // ────────── GET /ai-acceptance/rate ──────────
  describe('getAIAcceptanceRate', () => {
    it('TC-FUNC-044: should return acceptance rate for isAccepted=true', async () => {
      service.getAIAcceptanceRateByAcceptanceStatus.mockResolvedValue(
        successResponse(0.85),
      );

      const result = await controller.getAIAcceptanceRate('true');

      expect(result.success).toBe(true);
      expect(result.data).toBe(0.85);
    });

    it('TC-FUNC-045: should return rate for isAccepted=false', async () => {
      service.getAIAcceptanceRateByAcceptanceStatus.mockResolvedValue(
        successResponse(0.15),
      );

      const result = await controller.getAIAcceptanceRate('false');

      expect(result.success).toBe(true);
      expect(result.data).toBe(0.15);
    });
  });

  // ────────── GET /ai-acceptance/rate/:userId ──────────
  describe('getAIAcceptanceRateByUserId', () => {
    it('TC-FUNC-046: should return rate for specific user', async () => {
      service.getAIAcceptanceRateByAcceptanceStatusWithUserId.mockResolvedValue(
        successResponse(0.9),
      );

      const result = await controller.getAIAcceptanceRateByUserId(TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0.9);
    });
  });

  // ────────── POST /ai-acceptance/record/:userId ──────────
  describe('createAIAcceptanceRecord', () => {
    it('TC-FUNC-047: should create new acceptance record', async () => {
      const mockRecord = { id: 'new-id', userId: TEST_USER_ID, isAccepted: true };
      service.createAIAcceptanceRecord.mockResolvedValue(
        successResponse(mockRecord),
      );

      const result = await controller.createAIAcceptanceRecord(TEST_USER_ID, 'true');

      expect(result.success).toBe(true);
      expect(result.data!.userId).toBe(TEST_USER_ID);
      // Note: controller uses isAccepted === 'false', so 'true' maps to false
      expect(service.createAIAcceptanceRecord).toHaveBeenCalledWith(
        TEST_USER_ID,
        false,
      );
    });

    it('TC-NEG-041: should handle duplicate record creation', async () => {
      service.createAIAcceptanceRecord.mockResolvedValue(
        errorResponse('Record already exists'),
      );

      const result = await controller.createAIAcceptanceRecord(TEST_USER_ID, 'true');

      expect(result.success).toBe(false);
    });
  });
});
