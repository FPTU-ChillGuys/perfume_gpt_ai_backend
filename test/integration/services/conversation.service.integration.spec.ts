import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { getMapperToken } from '@automapper/nestjs';
import { Sender } from 'src/domain/enum/sender.enum';
import { MessageDto } from 'src/application/dtos/common/message.dto';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { v4 as uuidv4 } from 'uuid';

describe('ConversationService (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let service: ConversationService;

  beforeAll(async () => {
    module = await createIntegrationTestingModule([
      ConversationService,
      // Mapper is injected but not actually used (static mappers are used)
      { provide: getMapperToken(), useValue: {} },
    ]);
    orm = module.get(MikroORM);
    service = module.get(ConversationService);
  });

  beforeEach(async () => {
    await clearDatabase(orm);
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  function createConversationDto(overrides?: Partial<ConversationDto>): ConversationDto {
    return new ConversationDto({
      id: uuidv4(),
      userId: 'test-user-001',
      messages: [
        new MessageDto({ sender: Sender.USER, message: 'Hello' }),
        new MessageDto({ sender: Sender.ASSISTANT, message: 'Hi! How can I help?' }),
      ],
      ...overrides,
    });
  }

  // ────────── ADD ──────────
  describe('addConversation', () => {
    it('should save conversation with messages to database', async () => {
      const conv = createConversationDto();

      const result = await service.addConversation(conv);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe('test-user-001');
      expect(result.data!.messages).toHaveLength(2);
      expect(result.data!.messages![0].sender).toBe(Sender.USER);
      expect(result.data!.messages![0].message).toBe('Hello');
    });

    it('should reject duplicate conversation id', async () => {
      const conv = createConversationDto();
      await service.addConversation(conv);

      const duplicate = await service.addConversation(conv);

      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toContain('already exists');
    });

    it('should persist to database and be retrievable', async () => {
      const conv = createConversationDto();
      const addResult = await service.addConversation(conv);

      const getResult = await service.getConversationById(addResult.data!.id!);

      expect(getResult.success).toBe(true);
      expect(getResult.data!.messages).toHaveLength(2);
    });
  });

  // ────────── GET ──────────
  describe('getConversationById', () => {
    it('should return conversation with populated messages', async () => {
      const conv = createConversationDto();
      await service.addConversation(conv);

      const result = await service.getConversationById(conv.id!);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe(conv.id);
      expect(result.data!.messages).toBeDefined();
      expect(result.data!.messages!.length).toBeGreaterThan(0);
    });

    it('should return error for non-existent conversation', async () => {
      const fakeId = uuidv4();
      const result = await service.getConversationById(fakeId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('isExistConversation', () => {
    it('should return true for existing conversation', async () => {
      const conv = createConversationDto();
      await service.addConversation(conv);

      const exists = await service.isExistConversation(conv.id!);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent conversation', async () => {
      const fakeId = uuidv4();
      const exists = await service.isExistConversation(fakeId);

      expect(exists).toBe(false);
    });
  });

  describe('getAllConversations', () => {
    it('should return empty array when no conversations exist', async () => {
      const result = await service.getAllConversations();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return all conversations with messages', async () => {
      await service.addConversation(createConversationDto({ userId: 'user-1' }));
      await service.addConversation(createConversationDto({ userId: 'user-2' }));

      const result = await service.getAllConversations();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].messages).toBeDefined();
    });
  });

  // ────────── UPDATE ──────────
  describe('updateMessageToConversation', () => {
    it('should add new messages to existing conversation', async () => {
      const conv = createConversationDto();
      await service.addConversation(conv);

      const newMessages: MessageDto[] = [
        new MessageDto({ sender: Sender.USER, message: 'What perfume do you recommend?' }),
        new MessageDto({ sender: Sender.ASSISTANT, message: 'I recommend Chanel No.5.' }),
      ];

      const result = await service.updateMessageToConversation(conv.id!, newMessages);

      expect(result.success).toBe(true);
      // Should now have original 2 + new 2 messages
      const updated = await service.getConversationById(conv.id!);
      expect(updated.data!.messages!.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ────────── PAGINATION ──────────
  describe('getAllConversationsPaginated', () => {
    it('should return paginated results', async () => {
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await service.addConversation(createConversationDto({ userId: `user-${i}` }));
      }

      const result = await service.getAllConversationsPaginated({
        pageNumber: 1,
        pageSize: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data!.items).toHaveLength(2);
      expect(result.data!.totalCount).toBe(5);
      expect(result.data!.totalPages).toBe(3);
      expect(result.data!.pageNumber).toBe(1);
    });

    it('should filter by userId', async () => {
      await service.addConversation(createConversationDto({ userId: 'target' }));
      await service.addConversation(createConversationDto({ userId: 'target' }));
      await service.addConversation(createConversationDto({ userId: 'other' }));

      const result = await service.getAllConversationsPaginated({
        pageNumber: 1,
        pageSize: 10,
        userId: 'target',
      });

      expect(result.success).toBe(true);
      expect(result.data!.items).toHaveLength(2);
      expect(result.data!.totalCount).toBe(2);
    });

    it('should return empty page for out-of-range page number', async () => {
      await service.addConversation(createConversationDto());

      const result = await service.getAllConversationsPaginated({
        pageNumber: 999,
        pageSize: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data!.items).toHaveLength(0);
    });
  });
});
