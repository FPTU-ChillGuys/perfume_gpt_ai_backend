jest.mock('src/infrastructure/servicies/quiz.service', () => ({
  QuizService: class QuizService {}
}));

jest.mock('src/infrastructure/servicies/user-log.service', () => ({
  UserLogService: class UserLogService {}
}));

import { QuizProcessor } from 'src/infrastructure/processor/quiz.processor';
import { QuizJobName } from 'src/application/constant/processor';

describe('QuizProcessor', () => {
  const mockQuizService = {
    addQuizQuesAnws: jest.fn()
  };

  const mockUserLogService = {
    addQuizQuesAnsDetailToUserLog: jest.fn()
  };

  let processor: QuizProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new QuizProcessor(mockQuizService as any, mockUserLogService as any);
  });

  it('should process ADD_QUIZ_QUESTION_AND_ANSWER job successfully', async () => {
    mockQuizService.addQuizQuesAnws.mockResolvedValue({
      success: true,
      data: { id: 'quiz-answer-id' }
    });

    const job = {
      id: 'job-1',
      name: QuizJobName.ADD_QUIZ_QUESTION_AND_ANSWER,
      data: {
        userId: 'user-1',
        details: [{ questionId: 'q1', answerId: 'a1' }]
      }
    } as any;

    await processor.process(job);

    expect(mockQuizService.addQuizQuesAnws).toHaveBeenCalled();
    expect(mockUserLogService.addQuizQuesAnsDetailToUserLog).toHaveBeenCalledWith(
      'user-1',
      'quiz-answer-id'
    );
  });

  it('should skip log creation when quiz answer is not saved', async () => {
    mockQuizService.addQuizQuesAnws.mockResolvedValue({
      success: false,
      data: null
    });

    const job = {
      id: 'job-2',
      name: QuizJobName.ADD_QUIZ_QUESTION_AND_ANSWER,
      data: {
        userId: 'user-1',
        details: [{ questionId: 'q1', answerId: 'a1' }]
      }
    } as any;

    await processor.process(job);

    expect(mockUserLogService.addQuizQuesAnsDetailToUserLog).not.toHaveBeenCalled();
  });

  it('should throw for unknown job name', async () => {
    const job = {
      name: 'unknown_job',
      data: {}
    } as any;

    await expect(processor.process(job)).rejects.toThrow(
      'Unknown job name: unknown_job'
    );
  });
});
