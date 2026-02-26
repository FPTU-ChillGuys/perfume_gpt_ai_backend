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
          console.log('Processing conversation job with data:', job.data);
          await this.conversationService.saveOrUpdateConversation(job.data.responseConversation);
          console.log('Conversation saved successfully for job:', job.id);
          await this.userLogHelper.overrideWeeklyLogSummaryByUserId(job.data.userId);
          console.log('User log summary updated successfully for user:', job.data.userId);
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
