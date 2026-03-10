import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  ConversationJobName,
  QueueName
} from 'src/application/constant/processor';
import { ConversationService } from '../servicies/conversation.service';
import { Job } from 'bullmq';
import { UserLogHelper } from './helper/user-log.helper';

@Processor({
  name: QueueName.CONVERSATION_QUEUE,
})
export class ConversationProcessor extends WorkerHost {
  constructor(private conversationService: ConversationService, private userLogHelper: UserLogHelper) {
    super();
  }

  async process(job: Job): Promise<any> {
    try {
      console.log(`Received job ${job.name} with data:`, job.data);
      switch (job.name) {
        case ConversationJobName.ADD_MESSAGE_AND_LOG.toString():
          //Check type cua conversationDto
          await this.conversationService.saveOrUpdateConversation(job.data.responseConversation);
          //Check xem hôm nay có phải chủ nhật không? Nếu có thì override lại weekly log summary để tránh tiêu token khi người dùng có nhiều cuộc hội thoại trong tuần
          if (new Date().getDay() === 0) {
            await this.userLogHelper.overrideWeeklyLogSummaryByUserId(job.data.userId);
          }
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`Error processing job ${job.name}:`, error);
      throw error;
    }
  }
}
