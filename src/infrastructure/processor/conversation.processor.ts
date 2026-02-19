import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  ConversationJobName,
  QueueName
} from 'src/application/constant/processor';
import { ConversationService } from '../servicies/conversation.service';
import { Job } from 'bullmq';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { Scope } from '@nestjs/common';

@Processor({
    name: QueueName.CONVERSATION_QUEUE,
    scope: Scope.REQUEST
})
export class ConversationProcessor extends WorkerHost {
  constructor(private conversationService: ConversationService) {
    super();
  }
  async process(job: Job): Promise<any> {
    try {
      console.log(`Received job ${job.name} with data:`, job.data);
      switch (job.name) {
        case ConversationJobName.ADD_MESSAGE_AND_LOG.toString():
          //Check type cua conversationDto
            console.log('Processing conversation job with data:', job.data);
            return this.conversationService.saveOrUpdateConversation(job.data);
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`Error processing job ${job.name}:`, error);
      throw error;
    }
  }
}
