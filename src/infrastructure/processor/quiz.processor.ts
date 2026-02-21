import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueName, QuizJobName } from 'src/application/constant/processor';
import { QuizService } from '../servicies/quiz.service';
import { UserLogService } from '../servicies/user-log.service';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';

@Processor({
  name: QueueName.QUIZ_QUEUE
})
export class QuizProcessor extends WorkerHost {
  constructor(
    private quizService: QuizService,
    private logService: UserLogService
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    try {
      switch (job.name) {
        case QuizJobName.ADD_QUIZ_QUESTION_AND_ANSWER.toString():
          console.log('Processing quiz job with data:', job.data);
          //   Call the service method to add quiz question and answer
          const quizQuesAnsDetail = new QuizQuesAnwsRequest({
            userId: job.data.userId,
            details: job.data.details
          });

          const savedQuizQuesAnsResponse =
            await this.quizService.addQuizQuesAnws(quizQuesAnsDetail);

          if (!savedQuizQuesAnsResponse.success) {
            console.error(
              'Failed to add quiz question and answer for job:',
              job.id
            );
          }

          // Save user quiz log
          await this.logService.addQuizQuesAnsDetailToUserLog(
            job.data.userId,
            savedQuizQuesAnsResponse.data?.id || ''
          );

          console.log(
            'Quiz question and answer added successfully for job:',
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
