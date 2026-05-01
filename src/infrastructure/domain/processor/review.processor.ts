import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueueName, ReviewJobName } from 'src/application/constant/processor';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { ReviewAIService } from 'src/infrastructure/domain/review/review-ai.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';

@Processor({
  name: QueueName.REVIEW_QUEUE
})
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);

  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewAIService: ReviewAIService,
    private readonly prisma: PrismaService
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    try {
      this.logger.log(
        `Processing job ${job.name} (ID: ${job.id}) with data: ${JSON.stringify(job.data)}`
      );

      switch (job.name) {
        case ReviewJobName.PROCESS_REVIEW_SUMMARY:
          await this.handleProcessReviewSummary(job.data.variantId);
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing job ${job.name} (ID: ${job.id}): ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async handleProcessReviewSummary(variantId: string): Promise<void> {
    if (!variantId) {
      this.logger.warn(`VariantId missing in job data`);
      return;
    }

    this.logger.log(`Generating review summary for variantId: ${variantId}`);

    // 1. Generate AI summary for this variant
    const summaryResponse =
      await this.reviewAIService.generateReviewSummaryByVariantId(variantId);

    if (!summaryResponse.success || !summaryResponse.data) {
      this.logger.error(
        `Failed to generate AI summary for variant ${variantId}: ${summaryResponse.error || 'Unknown error'}`
      );
      return;
    }

    // 2. Save as ReviewLog
    const logResult = await this.reviewService.addReviewLog(
      ReviewTypeEnum.ID,
      variantId,
      summaryResponse.data
    );

    if (logResult.success) {
      this.logger.log(
        `Successfully updated review log for variant ${variantId}`
      );
    } else {
      this.logger.error(
        `Failed to save review log for variant ${variantId}: ${logResult.error}`
      );
    }
  }
}
