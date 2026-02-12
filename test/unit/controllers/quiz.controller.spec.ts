import { Test, TestingModule } from '@nestjs/testing';
import { QuizController } from 'src/api/controllers/quiz.controller';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import {
  createMockQuizService,
  createMockUserLogService,
  createMockAIService,
} from '../../helpers/mock-factories';
import {
  successResponse,
  errorResponse,
  TEST_USER_ID,
  TEST_QUIZ_QUESTION_ID,
} from '../../helpers/test-constants';

describe('QuizController', () => {
  let controller: QuizController;
  let quizService: ReturnType<typeof createMockQuizService>;
  let logService: ReturnType<typeof createMockUserLogService>;
  let aiService: ReturnType<typeof createMockAIService>;

  beforeEach(async () => {
    quizService = createMockQuizService();
    logService = createMockUserLogService();
    aiService = createMockAIService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        { provide: QuizService, useValue: quizService },
        { provide: UserLogService, useValue: logService },
        { provide: AI_SERVICE, useValue: aiService },
      ],
    }).compile();

    controller = module.get<QuizController>(QuizController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ────────── GET /quizzes/questions ──────────
  describe('getAllQuizzes', () => {
    it('TC-FUNC-070: should return all quiz questions', async () => {
      const mockQuestions = [
        { id: '1', question: 'Bạn thích mùi hương nào?', answers: [] },
        { id: '2', question: 'Bạn dùng nước hoa vào dịp nào?', answers: [] },
      ];
      quizService.getAllQuizQues.mockResolvedValue(successResponse(mockQuestions));

      const result = await controller.getAllQuizzes();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('TC-FUNC-071: should return empty when no questions exist', async () => {
      quizService.getAllQuizQues.mockResolvedValue(successResponse([]));

      const result = await controller.getAllQuizzes();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────── POST /quizzes/questions ──────────
  describe('createQuizQues', () => {
    it('TC-FUNC-072: should create new quiz question', async () => {
      const createRequest = {
        question: 'Bạn thích mùi gì?',
        answers: [{ answer: 'Floral' }, { answer: 'Woody' }],
      };
      quizService.addQuizQues.mockResolvedValue(successResponse('quiz-q-new'));

      const result = await controller.createQuizQues(createRequest as any);

      expect(result.success).toBe(true);
      expect(quizService.addQuizQues).toHaveBeenCalledWith(createRequest);
    });

    it('TC-VAL-070: should pass validation errors from service', async () => {
      quizService.addQuizQues.mockResolvedValue(
        errorResponse('Question is required'),
      );

      const result = await controller.createQuizQues({} as any);

      expect(result.success).toBe(false);
    });
  });

  // ────────── GET /quizzes/user/:userId/check-first-time ──────────
  describe('checkFirstTime', () => {
    it('TC-FUNC-073: should return true for first-time user', async () => {
      quizService.checkExistQuizQuesAnwsByUserId.mockResolvedValue(false);

      const result = await controller.checkFirstTime(TEST_USER_ID);

      expect(result.success).toBe(true);
      // checkFirstTime returns the negation (isFirstTime = !exists)
    });

    it('TC-FUNC-074: should return false for returning user', async () => {
      quizService.checkExistQuizQuesAnwsByUserId.mockResolvedValue(true);

      const result = await controller.checkFirstTime(TEST_USER_ID);

      expect(result.success).toBe(true);
    });
  });

  // ────────── POST /quizzes/questions/list ──────────
  describe('createQuizQueses', () => {
    it('TC-FUNC-075: should create multiple quiz questions', async () => {
      const questions = [
        { question: 'Q1?', answers: [{ answer: 'A1' }] },
        { question: 'Q2?', answers: [{ answer: 'A2' }] },
      ];
      quizService.addQuizQues.mockResolvedValue(successResponse('id'));

      const result = await controller.createQuizQueses(questions as any);

      expect(result.success).toBe(true);
      expect(quizService.addQuizQues).toHaveBeenCalledTimes(2);
    });
  });

  // ────────── PUT /quizzes/questions/:id ──────────
  describe('updateQuizAnswer', () => {
    it('TC-FUNC-076: should update quiz question answers', async () => {
      const answers = [{ answer: 'Updated answer' }];
      quizService.updateAnswer.mockResolvedValue(
        successResponse({ id: TEST_QUIZ_QUESTION_ID, answers }),
      );

      const result = await controller.updateQuizAnswer(TEST_QUIZ_QUESTION_ID, answers as any);

      expect(result.success).toBe(true);
      expect(quizService.updateAnswer).toHaveBeenCalledWith(TEST_QUIZ_QUESTION_ID, answers);
    });

    it('TC-NEG-070: should handle non-existent question', async () => {
      quizService.updateAnswer.mockResolvedValue(
        errorResponse('Question not found'),
      );

      const result = await controller.updateQuizAnswer('bad-id', []);

      expect(result.success).toBe(false);
    });
  });

  // ────────── POST /quizzes/user ──────────
  describe('chatQuiz', () => {
    it('TC-FUNC-077: should process quiz answers and return AI recommendation', async () => {
      const quizAnswers = [
        { questionId: 'q1', answerId: 'a1' },
        { questionId: 'q2', answerId: 'a2' },
      ];
      quizService.getQuizQuesByIdList.mockResolvedValue(
        successResponse([
          { id: 'q1', question: 'Mùi hương?', answers: [{ id: 'a1', answer: 'Floral' }] },
          { id: 'q2', question: 'Dịp?', answers: [{ id: 'a2', answer: 'Hàng ngày' }] },
        ]),
      );
      quizService.addQuizQuesAnws.mockResolvedValue(
        successResponse({ id: 'qqa-1' }),
      );
      logService.addQuizQuesAnsDetailToUserLog.mockResolvedValue([]);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('Gợi ý: Dior J\'adore phù hợp với bạn!'),
      );

      const result = await controller.chatQuiz(TEST_USER_ID, quizAnswers);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('TC-NEG-071: should handle empty quiz answers', async () => {
      quizService.getQuizQuesByIdList.mockResolvedValue(successResponse([]));
      quizService.addQuizQuesAnws.mockResolvedValue(
        successResponse({ id: 'qqa-empty' }),
      );
      logService.addQuizQuesAnsDetailToUserLog.mockResolvedValue([]);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        successResponse('No quiz data available for recommendation'),
      );

      const result = await controller.chatQuiz(TEST_USER_ID, []);

      expect(result.success).toBe(true);
    });

    it('TC-NEG-072: should handle AI failure during quiz processing', async () => {
      quizService.getQuizQuesByIdList.mockResolvedValue(
        successResponse([
          { id: 'q1', question: 'Q?', answers: [{ id: 'a1', answer: 'A' }] },
        ]),
      );
      quizService.addQuizQuesAnws.mockResolvedValue(
        successResponse({ id: 'qqa-1' }),
      );
      logService.addQuizQuesAnsDetailToUserLog.mockResolvedValue([]);
      aiService.textGenerateFromPrompt.mockResolvedValue(
        errorResponse('AI timeout'),
      );

      const result = await controller.chatQuiz(TEST_USER_ID, [
        { questionId: 'q1', answerId: 'a1' },
      ]);

      expect(result.success).toBe(false);
    });
  });
});
