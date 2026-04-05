jest.mock('src/infrastructure/servicies/quiz.service', () => ({
  SurveyService: class SurveyService {}
}));

jest.mock('src/infrastructure/servicies/user-log.service', () => ({
  UserLogService: class UserLogService {}
}));

import { QuizProcessor } from 'src/infrastructure/domain/processor/quiz.processor';
import { SurveyJobName } from 'src/application/constant/processor';

describe('QuizProcessor', () => {
  const mockQuizService = {
    addSurveyQuesAnws: jest.fn()
  };

  const mockUserLogService = {
    addSurveyQuesAnsDetailToUserLog: jest.fn()
  };

  let processor: QuizProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new QuizProcessor(mockQuizService as any, mockUserLogService as any);
  });

  it('should process ADD_SURVEY_QUESTION_AND_ANSWER job successfully', async () => {
    mockQuizService.addSurveyQuesAnws.mockResolvedValue({
      success: true,
      data: { id: 'quiz-answer-id' }
    });

    const job = {
      id: 'job-1',
      name: SurveyJobName.ADD_SURVEY_QUESTION_AND_ANSWER,
      data: {
        userId: 'user-1',
        details: [{ questionId: 'q1', answerId: 'a1' }]
      }
    } as any;

    await processor.process(job);

    expect(mockQuizService.addSurveyQuesAnws).toHaveBeenCalled();
    expect(mockUserLogService.addSurveyQuesAnsDetailToUserLog).toHaveBeenCalledWith(
      'user-1',
      'quiz-answer-id'
    );
  });

  it('should skip log creation when quiz answer is not saved', async () => {
    mockQuizService.addSurveyQuesAnws.mockResolvedValue({
      success: false,
      data: null
    });

    const job = {
      id: 'job-2',
      name: SurveyJobName.ADD_SURVEY_QUESTION_AND_ANSWER,
      data: {
        userId: 'user-1',
        details: [{ questionId: 'q1', answerId: 'a1' }]
      }
    } as any;

    await processor.process(job);

    expect(mockUserLogService.addSurveyQuesAnsDetailToUserLog).not.toHaveBeenCalled();
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
