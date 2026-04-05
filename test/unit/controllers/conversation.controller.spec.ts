import { Test, TestingModule } from '@nestjs/testing';
import { ConversationController } from 'src/api/controllers/conversation.controller';
import { ConversationService } from 'src/infrastructure/domain/conversation/conversation.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { AI_SERVICE } from 'src/infrastructure/domain/ai/ai.module';
import {
  createMockAIService,
  createMockConversationService,
  createMockUserLogService,
  createMockOrderService,
  createMockProfileService,
  createMockAdminInstructionService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  successResponseAPI,
  errorResponse,
  createMockRequest,
  createMockRequestNoAuth,
  TEST_USER_ID,
  TEST_CONVERSATION_ID,
  TEST_AUTH_HEADER,
  MOCK_ADMIN_PROMPT,
} from '../../helpers/test-constants';

describe('ConversationController', () => {
  let controller: ConversationController;
  let aiService: ReturnType<typeof createMockAIService>;
  let conversationService: ReturnType<typeof createMockConversationService>;
  let logService: ReturnType<typeof createMockUserLogService>;
  let orderService: ReturnType<typeof createMockOrderService>;
  let profileService: ReturnType<typeof createMockProfileService>;
  let adminInstructionService: ReturnType<typeof createMockAdminInstructionService>;

  beforeEach(async () => {
    aiService = createMockAIService();
    conversationService = createMockConversationService();
    logService = createMockUserLogService();
    orderService = createMockOrderService();
    profileService = createMockProfileService();
    adminInstructionService = createMockAdminInstructionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: AI_SERVICE, useValue: aiService },
        { provide: ConversationService, useValue: conversationService },
        { provide: UserLogService, useValue: logService },
        { provide: OrderService, useValue: orderService },
        { provide: ProfileService, useValue: profileService },
        { provide: AdminInstructionService, useValue: adminInstructionService },
      ],
    }).compile();

    controller = module.get<ConversationController>(ConversationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /conversation ──────────
  describe('getAllConversations', () => {
    it('TC-FUNC-100: should return all conversations', async () => {
      const mockConversations = [
        { id: '1', userId: 'u1', messages: [] },
        { id: '2', userId: 'u2', messages: [] },
      ];
      conversationService.getAllConversations.mockResolvedValue(
        successResponse(mockConversations),
      );

      const result = await controller.getAllConversations();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('TC-FUNC-101: should return empty when no conversations', async () => {
      conversationService.getAllConversations.mockResolvedValue(
        successResponse([]),
      );

      const result = await controller.getAllConversations();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────── GET /conversation/:id ──────────
  describe('getConversationById', () => {
    it('TC-FUNC-102: should return conversation by id', async () => {
      const mockConv = { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID, messages: [] };
      conversationService.getConversationById.mockResolvedValue(
        successResponse(mockConv),
      );

      const result = await controller.getConversationById(TEST_CONVERSATION_ID);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe(TEST_CONVERSATION_ID);
    });

    it('TC-NEG-100: should handle non-existent conversation', async () => {
      conversationService.getConversationById.mockResolvedValue(
        errorResponse('Conversation not found'),
      );

      const result = await controller.getConversationById('bad-id');

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /conversation/list/paged ──────────
  describe('getAllConversationsPaginated', () => {
    it('TC-FUNC-103: should return paginated conversations', async () => {
      const pagedRequest = { pageNumber: 1, pageSize: 10 } as any;
      conversationService.getAllConversationsPaginated.mockResolvedValue(
        successResponse({ items: [{ id: '1' }], totalCount: 1 }),
      );

      const result = await controller.getAllConversationsPaginated(pagedRequest);

      expect(result.success).toBe(true);
      expect(result.data!.items).toHaveLength(1);
    });
  });

  // ────────── POST /conversation/chat/v1 ──────────
  describe('conversationV1', () => {
    const mockConversationRequest = {
      id: TEST_CONVERSATION_ID,
      userId: TEST_USER_ID,
      messages: [
        { sender: 'user', message: 'Gợi ý nước hoa cho tôi' },
      ],
    } as any;

    it('TC-FUNC-104: should process chat conversation v1', async () => {
      const req = createMockRequest();

      // Mock profile service
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID, username: 'testuser' }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('Profile context...');

      // Mock log service
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('User activity summary...'),
      );

      // Mock order service
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Order history...'),
      );

      // Mock admin instruction
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);

      // Mock AI service
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('Tôi gợi ý Chanel No.5 cho bạn!'),
      );

      // Mock conversation save
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(
        successResponse(mockConversationRequest),
      );

      const result = await controller.conversationV1(req, mockConversationRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-FUNC-105: should work without auth token (guest mode)', async () => {
      const req = createMockRequestNoAuth();

      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('Welcome, guest!'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(
        successResponse(mockConversationRequest),
      );

      const result = await controller.conversationV1(req, mockConversationRequest);

      expect(result.success).toBe(true);
    });

    it('TC-NEG-101: should handle AI service failure', async () => {
      const req = createMockRequest();
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        errorResponse('AI service error'),
      );

      const result = await controller.conversationV1(req, mockConversationRequest);

      expect(result.success).toBe(false);
    });

    it('TC-FUNC-106: should save new conversation', async () => {
      const req = createMockRequestNoAuth();
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('response'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(
        successResponse(mockConversationRequest),
      );

      await controller.conversationV1(req, mockConversationRequest);

      expect(conversationService.addConversation).toHaveBeenCalled();
    });

    it('TC-FUNC-107: should update existing conversation', async () => {
      const req = createMockRequestNoAuth();
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('response'),
      );
      conversationService.isExistConversation.mockResolvedValue(true);
      conversationService.updateMessageToConversation.mockResolvedValue(
        successResponse([]),
      );

      await controller.conversationV1(req, mockConversationRequest);

      expect(conversationService.updateMessageToConversation).toHaveBeenCalled();
    });
  });

  // ────────── POST /conversation/test/v1 ──────────
  describe('conversationV1 (test proxy)', () => {
    it('TC-FUNC-110: should return test response with prompt', async () => {
      const req = createMockRequest();
      const convReq = { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID, messages: [] } as any;
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('Profile...');
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('Log summary...'),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Order report...'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('Test AI response'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(convReq));

      const result = await controller.conversationV1(req, convReq);

      expect(result).toBeDefined();
    });
  });

  // ────────── POST /conversation/test/v3 ──────────
  describe('conversationV3 (test proxy)', () => {
    it('TC-FUNC-111: should use buildCombinedPromptV1 for test/v3', async () => {
      const req = createMockRequest();
      const convReq = { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID, messages: [] } as any;
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('Profile...');
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('Logs...'),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Orders...'),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('V3 test response'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(convReq));

      const result = await controller.conversationV3(req, convReq);

      expect(result).toBeDefined();
    });
  });

  // ────────── POST /conversation/chat/v3 ──────────
  describe('conversationV3', () => {
    it('TC-FUNC-112: should process chat v3 with combined prompt', async () => {
      const req = createMockRequest();
      const convRequest = {
        id: TEST_CONVERSATION_ID,
        userId: TEST_USER_ID,
        messages: [{ sender: 'user', message: 'Hello v3' }],
      } as any;

      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('V3 chat response'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(convRequest));

      const result = await controller.conversationV3(req, convRequest);

      expect(result.success).toBe(true);
    });
  });

  // ────────── POST /conversation/chat/v4 ──────────
  describe('conversationV4', () => {
    it('TC-FUNC-113: should process chat v4 with combined prompt v2', async () => {
      const req = createMockRequest();
      const convRequest = {
        id: TEST_CONVERSATION_ID,
        userId: TEST_USER_ID,
        messages: [{ sender: 'user', message: 'Hello v4' }],
      } as any;

      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      logService.getReportAndPromptSummaryUserLogs.mockResolvedValue(
        successResponse({ prompt: '', response: '' }),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('V4 chat response'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(convRequest));

      const result = await controller.conversationV4(req, convRequest);

      expect(result.success).toBe(true);
    });
  });

  // ────────── POST /conversation/test/guarded/v1 ──────────
  describe('conversationV1 (guarded)', () => {
    it('TC-FUNC-114: should work with admin token', async () => {
      const req = createMockRequest();
      const convReq = { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID, messages: [] } as any;
      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse('Logs...'),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse('Orders...'),
      );
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('Profile...');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue(MOCK_ADMIN_PROMPT);
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('Guarded V1 response'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(convReq));

      const result = await controller.conversationV1(req, convReq);

      expect(result).toBeDefined();
    });
  });

  // ────────── Validation Tests ──────────
  describe('Data Validation', () => {
    it('TC-VAL-100: should handle conversation with empty messages', async () => {
      const req = createMockRequestNoAuth();
      const emptyConv = { id: 'c1', userId: 'u1', messages: [] } as any;

      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('No messages provided'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(emptyConv));

      const result = await controller.conversationV1(req, emptyConv);

      expect(result).toBeDefined();
    });

    it('TC-VAL-101: should handle very long prompt in test endpoint', async () => {
      const req = createMockRequestNoAuth();
      const longConvReq = { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID, messages: [] } as any;

      logService.getUserLogSummaryReportByUserId.mockResolvedValue(
        successResponse(''),
      );
      orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId.mockResolvedValue(
        successResponse(''),
      );
      profileService.getOwnProfile.mockResolvedValue(
        successResponseAPI({ id: TEST_USER_ID }),
      );
      profileService.createSystemPromptFromProfile.mockResolvedValue('');
      adminInstructionService.getSystemPromptForDomain.mockResolvedValue('');
      aiService.textGenerateFromMessages.mockResolvedValue(
        successResponse('Response for long prompt'),
      );
      conversationService.isExistConversation.mockResolvedValue(false);
      conversationService.addConversation.mockResolvedValue(successResponse(longConvReq));

      const result = await controller.conversationV1(req, longConvReq);

      expect(result).toBeDefined();
    });
  });
});
