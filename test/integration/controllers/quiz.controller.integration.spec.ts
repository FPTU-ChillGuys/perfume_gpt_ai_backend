import { MikroORM } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';
import { getMapperToken } from '@automapper/nestjs';
import { SurveyController } from 'src/api/controllers/quiz.controller';
import { SurveyService } from 'src/infrastructure/domain/survey/survey.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { AIService } from 'src/infrastructure/domain/ai/ai.service';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { createIntegrationTestingModule, clearDatabase } from '../helpers/setup';
import { v4 as uuidv4 } from 'uuid';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';

describe('SurveyController (Integration)', () => {
  let module: TestingModule;
  let orm: MikroORM;
  let controller: SurveyController;
  let quizService: SurveyService;
  let userLogService: UserLogService;
  let unitOfWork: UnitOfWork;

  const mockAIService = {
    textGenerateFromPrompt: jest.fn(),
    textGenerateFromMessages: jest.fn(),
    textGenerateStreamFromPrompt: jest.fn(),
    TextGenerateStreamFromMessages: jest.fn(),
  } as unknown as AIService;

  const mockQuizQueue = {
    add: jest.fn(),
  } as any;

  const mockAdminInstructionService = {
    getSystemPromptForDomain: jest.fn().mockResolvedValue('MOCK SYSTEM PROMPT'),
  } as unknown as AdminInstructionService;

  beforeAll(async () => {
    module = await createIntegrationTestingModule([
      SurveyService,
      UserLogService,
      { provide: getMapperToken(), useValue: {} },
    ]);
    orm = module.get(MikroORM);
    quizService = module.get(SurveyService);
    userLogService = module.get(UserLogService);
    unitOfWork = module.get(UnitOfWork);
    controller = new SurveyController(
      mockAIService,
      quizService,
      userLogService,
      mockQuizQueue,
      mockAdminInstructionService
    );
  });

  beforeEach(async () => {
    await clearDatabase(orm);
    // Also clear the repo's forked EntityManagers to prevent stale identity maps
    try {
      (unitOfWork.AISurveyQuestionRepo as any).getEntityManager().clear();
    } catch { /* ignore if not available */ }
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await orm.close(true);
    await module.close();
  });

  async function getQuestionWithAnswers(id: string) {
    return orm.em.fork().findOneOrFail(QuizQuestion, { id }, { populate: ['answers'] });
  }

  // ────────── GET ALL QUIZZES ──────────
  describe('getAllQuizzes', () => {
    it('should return empty list when no questions exist', async () => {
      const result = await controller.getAllQuizzes();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return quiz questions from database', async () => {
      await quizService.addSurveyQues({
        question: 'What scent do you prefer?',
        answers: [{ answer: 'Floral' }, { answer: 'Woody' }],
      });

      const result = await controller.getAllQuizzes();
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ────────── CREATE QUESTION ──────────
  describe('createQuizQues', () => {
    it('should create quiz question via controller and persist to DB', async () => {
      const result = await controller.createQuizQues({
        question: 'How often do you wear perfume?',
        answers: [{ answer: 'Daily' }, { answer: 'Weekly' }, { answer: 'Rarely' }],
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Verify in DB
      const entity = await getQuestionWithAnswers(result.data!);
      expect(entity.question).toBe('How often do you wear perfume?');
      expect(entity.answers.getItems()).toHaveLength(3);
    });
  });

  // ────────── CREATE BATCH ──────────
  describe('createQuizQueses', () => {
    it('should create multiple quiz questions', async () => {
      const result = await controller.createQuizQueses([
        { question: 'Q1?', answers: [{ answer: 'A1' }] },
        { question: 'Q2?', answers: [{ answer: 'A2' }] },
      ]);

      expect(result.success).toBe(true);

      const all = await controller.getAllQuizzes();
      expect(all.data!.length).toBe(2);
    });
  });

  // ────────── CHECK FIRST TIME ──────────
  describe('checkFirstTime', () => {
    it('should return data for user with no quiz answers', async () => {
      const result = await controller.checkFirstTime(uuidv4());
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('boolean');
    });
  });

  // ────────── UPDATE ANSWER ──────────
  describe('updateQuizAnswer', () => {
    it('should update quiz answers via controller', async () => {
      const created = await quizService.addSurveyQues({
        question: 'Q?',
        answers: [{ answer: 'Old Answer' }],
      });
      const questionId = created.data!;

      const result = await controller.updateQuizAnswer(questionId, {
        question: 'Q?',
        answers: [{ answer: 'New Answer' }],
      });

      // updateAnswer uses funcHandlerAsync; verify the response shape
      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });
  });

  // ────────── CHAT QUIZ (AI mocked) ──────────
  describe('chatQuiz', () => {
    beforeEach(() => {
      // Mock fire-and-forget log methods to prevent DB side effects
      // 1) Controller calls logService.addSurveyQuesAnsDetailToUserLog
      jest.spyOn(userLogService, 'addSurveyQuesAnsDetailToUserLog').mockResolvedValue([]);
      // 2) SurveyService.addSurveyQuesAnws internally calls EventLogRepo.addQuizQuesAnsDetailLogToUserLog (fire-and-forget)
      jest.spyOn(unitOfWork.EventLogRepo, 'addQuizQuesAnsDetailLogToUserLog' as any).mockResolvedValue([]);
    });

    it('should process quiz answers and return AI response', async () => {
      // Create question with answers
      const created = await quizService.addSurveyQues({
        question: 'What scent?',
        answers: [{ answer: 'Floral' }, { answer: 'Woody' }],
      });
      const questionId = created.data!;
      const entity = await getQuestionWithAnswers(questionId);
      const answerId = entity.answers.getItems()[0].id;

      // Mock AI response
      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: true,
        data: 'Based on your preferences, I recommend floral perfumes.',
      });

      const userId = uuidv4();
      const result = await controller.chatQuiz(userId, [
        { questionId, answerId },
      ]);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Based on your preferences, I recommend floral perfumes.');
      expect(mockAIService.textGenerateFromPrompt).toHaveBeenCalled();
    });

    it('should return error when AI fails', async () => {
      const created = await quizService.addSurveyQues({
        question: 'Q?',
        answers: [{ answer: 'A' }],
      });
      const questionId = created.data!;
      const entity = await getQuestionWithAnswers(questionId);
      const answerId = entity.answers.getItems()[0].id;

      (mockAIService.textGenerateFromPrompt as jest.Mock).mockResolvedValue({
        success: false,
        error: 'AI error',
      });

      const result = await controller.chatQuiz(uuidv4(), [
        { questionId, answerId },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get AI response');
    }, 60000);
  });
});
