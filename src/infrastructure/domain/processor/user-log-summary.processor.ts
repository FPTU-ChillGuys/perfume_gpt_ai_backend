import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(UserLogSummaryProcessor.name);

  constructor(private readonly userLogService: UserLogService) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      if (job.name !== UserLogSummaryJobName.UPDATE_ROLLING_SUMMARY) {
        throw new Error(`Unknown job name: ${job.name}`);
      }

      const userId =
        typeof job.data?.userId === 'string' ? job.data.userId : '';
      if (!userId) {
        this.logger.warn(
          `Skip summary job because userId is missing. jobId=${job.id}`
        );
        return;
      }

      this.logger.log(
        `Processing user log summary job for userId=${userId}, jobId=${job.id}, name=${job.name}`
      );
      await this.userLogService.rebuildRollingSummaryForUser(userId);
      this.logger.log(
        `Completed user log summary job for userId=${userId}, jobId=${job.id}`
      );
    } catch (error) {
      this.logger.error(
        `Error processing user log summary job ${job.name} for jobId=${job.id}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }
}
