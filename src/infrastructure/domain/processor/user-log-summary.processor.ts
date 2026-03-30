import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QueueName,
  UserLogSummaryJobName
} from 'src/application/constant/processor';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';

@Processor({
  name: QueueName.USER_LOG_SUMMARY_QUEUE
})
export class UserLogSummaryProcessor extends WorkerHost {
  constructor(private readonly userLogService: UserLogService) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      if (job.name !== UserLogSummaryJobName.UPDATE_ROLLING_SUMMARY) {
        throw new Error(`Unknown job name: ${job.name}`);
      }

      const userId = typeof job.data?.userId === 'string' ? job.data.userId : '';
      if (!userId) {
        return;
      }

      console.log(`Processing user log summary job for userId: ${userId}`);
      await this.userLogService.rebuildRollingSummaryForUser(userId);
      console.log(`Completed user log summary job for userId: ${userId}`);
    } catch (error) {
      console.error(`Error processing user log summary job ${job.name}:`, error);
      throw error;
    }
  }
}
