import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueName, SurveyJobName } from 'src/application/constant/processor';
import { SurveyService } from 'src/infrastructure/domain/survey/survey.service';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { SurveyQuesAnwsRequest } from 'src/application/dtos/request/survey-ques-ans.request';

@Processor({
  name: QueueName.SURVEY_QUEUE
})
export class SurveyProcessor extends WorkerHost {
  constructor(
    private surveyService: SurveyService,
    private logService: UserLogService
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    try {
      switch (job.name) {
        case SurveyJobName.ADD_SURVEY_QUESTION_AND_ANSWER.toString():
          //   Call the service method to add survey question and answer
          const surveyQuesAnsDetail = new SurveyQuesAnwsRequest({
            userId: job.data.userId,
            details: job.data.details
          });

          const savedSurveyQuesAnsResponse =
            await this.surveyService.addSurveyQuesAnws(surveyQuesAnsDetail);

          if (!savedSurveyQuesAnsResponse.success || !savedSurveyQuesAnsResponse.data?.id) {
            console.error(
              'Failed to add survey question and answer for job:',
              job.id
            );
            break;
          }

          // Save user survey log
          await this.logService.addSurveyQuesAnsDetailToUserLog(
            job.data.userId,
            savedSurveyQuesAnsResponse.data.id
          );

          console.log(
            'Survey question and answer added successfully for job:',
            job.id
          );

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
