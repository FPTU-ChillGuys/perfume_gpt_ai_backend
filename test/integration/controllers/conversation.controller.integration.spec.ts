import { MikroORM } from '@mikro-orm/core';
import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { getMapperToken } from '@automapper/nestjs';
import { ConversationController } from 'src/api/controllers/conversation.controller';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
import { MessageDto, MessageRequestDto } from 'src/application/dtos/common/message.dto';
import { Sender } from 'src/domain/enum/sender.enum';
import { PagedConversationRequest } from 'src/application/dtos/request/paged-conversation.request';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

const mockOrderHttpService = { get: jest.fn() };
const mockProfileHttpService = { get: jest.fn() };

function mockRequest(token = 'test-token'): Request {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

describe('ConversationController (Integration)', () => {
  let dbModule: TestingModule;
  let orm: MikroORM;
  let controller: ConversationController;
  let conversationService: ConversationService;
  let userLogService: UserLogService;
  let orderService: OrderService;
  let profileService: ProfileService;
  let adminInstructionService: AdminInstructionService;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
    textGenerateStreamFromPrompt: jest.fn(),
    TextGenerateStreamFromMessages: jest.fn(),
  } as unknown as AIService;

  const userId = uuidv4();

  beforeAll(async () => {
    dbModule = await createIntegrationTestingModule([
      ConversationService,
      UserLogService,
      AdminInstructionService,
      { provide: getMapperToken(), useValue: {} },
    ]);
    orm = dbModule.get(MikroORM);
    conversationService = dbModule.get(ConversationService);
    userLogService = dbModule.get(UserLogService);
    adminInstructionService = dbModule.get(AdminInstructionService);

    // Create services with mock HTTP
    const orderHttpModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: HttpService, useValue: mockOrderHttpService },
      ],
    }).compile();
    orderService = orderHttpModule.get(OrderService);

    const profileHttpModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: HttpService, useValue: mockProfileHttpService },
      ],
    }).compile();
    profileService = profileHttpModule.get(ProfileService);

    controller = new ConversationController(
      mockAIService,
      conversationService,
      userLogService,
      orderService,
      profileService,
      adminInstructionService,
    );
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    jest.clearAllMocks();

    // Default mocks for HTTP services
    mockOrderHttpService.get.mockReturnValue(
      of(axiosResponse({ success: true, payload: { items: [], totalCount: 0 } })),
    );
    mockProfileHttpService.get.mockReturnValue(
      of(axiosResponse({ success: true, payload: { id: userId, firstName: 'Test', lastName: 'User' } })),
    );
  });

  afterAll(async () => {
    await orm.close(true);
    await dbModule.close();
  });

  // ────────── GET ALL CONVERSATIONS ──────────
  describe('getAllConversations', () => {
    it('should return empty array when no conversations', async () => {
      const result = await controller.getAllConversations();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return conversations from database', async () => {
      const conv = new ConversationDto({
        id: uuidv4(),
        userId,
        messages: [
          new MessageDto({ sender: Sender.USER, message: 'Hello' }),
        ],
      });
      await conversationService.addConversation(conv);

      const result = await controller.getAllConversations();
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ────────── GET BY ID ──────────
  describe('getConversationById', () => {
    it('should return conversation by id', async () => {
      const convId = uuidv4();
      const conv = new ConversationDto({
        id: convId,
        userId,
        messages: [
          new MessageDto({ sender: Sender.USER, message: 'Hi there' }),
          new MessageDto({ sender: Sender.ASSISTANT, message: 'Hello!' }),
        ],
      });
      await conversationService.addConversation(conv);

      const result = await controller.getConversationById(convId);
      expect(result.success).toBe(true);
      expect(result.data!.messages).toHaveLength(2);
    });

    it('should handle non-existent conversation', async () => {
      const result = await controller.getConversationById(uuidv4());
      expect(result.success).toBe(false);
    });
  });

  // ────────── PAGINATED LIST ──────────
  describe('getAllConversationsPaginated', () => {
    it('should return paginated conversations', async () => {
      const conv = new ConversationDto({
        id: uuidv4(),
        userId,
        messages: [
          new MessageDto({ sender: Sender.USER, message: 'Test' }),
        ],
      });
      await conversationService.addConversation(conv);

      const request = new PagedConversationRequest();
      const result = await controller.getAllConversationsPaginated(request);
      expect(result.success).toBe(true);
    });
  });

  // ────────── CHAT V3 (uses buildCombinedPromptV1) ──────────
  describe('conversationV3', () => {
    it('should create new conversation with AI response', async () => {
      const convId = uuidv4();

      (mockAIService.textGenerateFromMessages as jest.Mock).mockResolvedValue({
        success: true,
        data: 'I recommend trying Chanel No.5 for your preferences.',
      });

      const conversation = new ConversationRequestDto();
      conversation.id = convId;
      conversation.userId = userId;
      conversation.messages = [
        new MessageRequestDto({ sender: Sender.USER, message: 'Suggest me a perfume' }),
      ];

      const result = await controller.conversationV3(mockRequest(), conversation);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.messages!.length).toBeGreaterThanOrEqual(1);
    });

    it('should update existing conversation', async () => {
      const convId = uuidv4();

      // Create initial conversation
      const conv = new ConversationDto({
        id: convId,
        userId,
        messages: [
          new MessageDto({ sender: Sender.USER, message: 'Hello' }),
          new MessageDto({ sender: Sender.ASSISTANT, message: 'Hi!' }),
        ],
      });
      await conversationService.addConversation(conv);

      (mockAIService.textGenerateFromMessages as jest.Mock).mockResolvedValue({
        success: true,
        data: 'Here is another recommendation.',
      });

      const conversation = new ConversationRequestDto();
      conversation.id = convId;
      conversation.userId = userId;
      conversation.messages = [
        new MessageRequestDto({ sender: Sender.USER, message: 'Hello' }),
        new MessageRequestDto({ sender: Sender.ASSISTANT, message: 'Hi!' }),
        new MessageRequestDto({ sender: Sender.USER, message: 'More suggestions?' }),
      ];

      const result = await controller.conversationV3(mockRequest(), conversation);

      expect(result.success).toBe(true);
    });

    it('should handle AI failure', async () => {
      (mockAIService.textGenerateFromMessages as jest.Mock).mockResolvedValue({
        success: false,
        error: 'AI is unavailable',
      });

      const conversation = new ConversationRequestDto();
      conversation.id = uuidv4();
      conversation.userId = userId;
      conversation.messages = [
        new MessageRequestDto({ sender: Sender.USER, message: 'Suggest perfume' }),
      ];

      const result = await controller.conversationV3(mockRequest(), conversation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get AI response');
    });
  });

  // ────────── TEST V3 (prompt-based) ──────────
  describe('conversationV3Test', () => {
    it('should return AI text response for prompt', async () => {
      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'For floral scents, try Jo Malone.',
      });

      const result = await controller.conversationV3Test(
        mockRequest(),
        userId,
        'Recommend a floral perfume',
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('For floral scents, try Jo Malone.');
    });
  });

  // ────────── TEST V4 (prompt-based with detailed logs) ──────────
  describe('conversationV4Test', () => {
    it('should return AI text response using detailed logs', async () => {
      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'Based on detailed analysis, try Dior Sauvage.',
      });

      const result = await controller.conversationV4Test(
        mockRequest(),
        userId,
        'What perfume suits me?',
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('Based on detailed analysis, try Dior Sauvage.');
    });
  });
});
