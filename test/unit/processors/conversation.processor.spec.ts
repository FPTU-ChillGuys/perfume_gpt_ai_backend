jest.mock('src/infrastructure/servicies/conversation.service', () => ({
  ConversationService: class ConversationService {}
}));

jest.mock('src/infrastructure/processor/helper/user-log.helper', () => ({
  UserLogHelper: class UserLogHelper {}
}));

import { ConversationProcessor } from 'src/infrastructure/processor/conversation.processor';
import { ConversationJobName } from 'src/application/constant/processor';

describe('ConversationProcessor', () => {
  const mockConversationService = {
    saveOrUpdateConversation: jest.fn()
  };

  const mockUserLogHelper = {
    overrideWeeklyLogSummaryByUserId: jest.fn()
  };

  let processor: ConversationProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ConversationProcessor(
      mockConversationService as any,
      mockUserLogHelper as any
    );
  });

  it('should process ADD_MESSAGE_AND_LOG job successfully', async () => {
    const daySpy = jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);

    const job = {
      name: ConversationJobName.ADD_MESSAGE_AND_LOG,
      data: {
        responseConversation: { id: 'conv-1' },
        userId: 'user-1'
      }
    } as any;

    await processor.process(job);

    expect(mockConversationService.saveOrUpdateConversation).toHaveBeenCalledWith({
      id: 'conv-1'
    });
    expect(mockUserLogHelper.overrideWeeklyLogSummaryByUserId).not.toHaveBeenCalled();

    daySpy.mockRestore();
  });

  it('should override weekly summary when job runs on Sunday', async () => {
    const daySpy = jest.spyOn(Date.prototype, 'getDay').mockReturnValue(0);

    const job = {
      name: ConversationJobName.ADD_MESSAGE_AND_LOG,
      data: {
        responseConversation: { id: 'conv-1' },
        userId: 'user-1'
      }
    } as any;

    await processor.process(job);

    expect(mockUserLogHelper.overrideWeeklyLogSummaryByUserId).toHaveBeenCalledWith(
      'user-1'
    );

    daySpy.mockRestore();
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
