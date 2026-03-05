import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuesAnsDetailRequest } from 'src/application/dtos/request/quiz-ques-ans-detail.request';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { QuizQuestionResponse } from 'src/application/dtos/response/quiz-question.response';
import {
  QUIZ_SYSTEM_PROMPT,
  quizPrompt
} from 'src/application/constant/prompts';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { Output } from 'ai';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import { QuizQuestionAnswerResponse } from 'src/application/dtos/response/quiz-question-answer.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { BadRequestWithDetailsException, InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { QueueName, QuizJobName } from 'src/application/constant/processor';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private quizService: QuizService,
    private logService: UserLogService,
    @InjectQueue(QueueName.QUIZ_QUEUE)
    private readonly quizQueue: Queue
  ) { }

  /** Lấy tất cả câu hỏi quiz */
  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi quiz' })
  @ApiBaseResponse(QuizQuestionResponse, true)
  async getAllQuizzes(): Promise<BaseResponse<QuizQuestionResponse[]>> {
    const quizQues = await this.quizService.getAllQuizQues();

    if (!quizQues.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get quiz questions',
        { service: 'QuizService' }
      );
    }

    return Ok(quizQues.data);
  }

  /** Lấy câu hỏi quiz theo ID */
  @Public()
  @Get('questions/:id')
  @ApiOperation({ summary: 'Lấy câu hỏi quiz theo ID' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiBaseResponse(QuizQuestionResponse)
  async getQuizQuesById(
    @Param('id') id: string
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return this.quizService.getQuizQuesById(id);
  }

  /** Tạo câu hỏi quiz mới */
  @Role(['admin'])
  @Post('questions')
  @ApiOperation({ summary: 'Tạo câu hỏi quiz mới' })
  @ApiBaseResponse(String)
  async createQuizQues(
    @Body() quizQuestionRequest: QuizQuestionRequest
  ): Promise<BaseResponse<string>> {
    return this.quizService.addQuizQues(quizQuestionRequest);
  }

  /** Kiểm tra người dùng đã làm quiz lần đầu chưa */
  @Public()
  @Get('user/:userId/check-first-time')
  @ApiOperation({ summary: 'Kiểm tra người dùng đã làm quiz lần đầu chưa' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(Boolean)
  async checkFirstTime(
    @Param('userId') userId: string
  ): Promise<BaseResponse<boolean>> {
    const isFirstTime =
      await this.quizService.checkExistQuizQuesAnwsByUserId(userId);
    return Ok(isFirstTime);
  }

  /** Tạo nhiều câu hỏi quiz cùng lúc */
  @Public()
  @Post('questions/list')
  @ApiOperation({ summary: 'Tạo nhiều câu hỏi quiz cùng lúc' })
  @ApiBody({ type: [QuizQuestionRequest] })
  @ApiBaseResponse(String)
  async createQuizQueses(
    @Body() quizQuestionRequest: QuizQuestionRequest[]
  ): Promise<BaseResponse<void>> {
    for (const quizQuestion of quizQuestionRequest) {
      await this.quizService.addQuizQues(quizQuestion);
    }
    return Ok();
  }

  /** Cập nhật câu trả lời quiz */
  @Put('questions/:id')
  @ApiOperation({ summary: 'Cập nhật câu trả lời quiz' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiBody({ type: [QuizAnswerRequest] })
  @ApiBaseResponse(QuizQuestionResponse)
  async updateQuizAnswer(
    @Param() id: string,
    @Body() quizAnswerRequest: QuizAnswerRequest[]
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return this.quizService.updateAnswer(id, quizAnswerRequest);
  }

  /** Trả lời quiz và nhận gợi ý nước hoa từ AI */
  @Public()
  @Post('user')
  @ApiOperation({ summary: 'Trả lời quiz và nhận gợi ý AI' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [QuizQuesAnsDetailRequest] })
  async chatQuiz(
    @Query('userId') userId: string,
    @Body() quizAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    // Lay cau hoi quiz va cau tra loi tuong ung
    const questionIds = quizAnswers.map((qa) => qa.questionId);
    const quizQueses = await this.quizService.getQuizQuesByIdList(questionIds);
    if (!quizQueses.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get quiz question',
        { questionIds }
      );
    }

    // Map từng quizAnswer (questionId + answerId) sang cặp (question text + answer text)
    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (quizQueses.data) {
      for (const quizAnswer of quizAnswers) {
        const quizQues = quizQueses.data.find((q) => q.id === quizAnswer.questionId);
        if (quizQues?.answers && quizQues.question) {
          const answer = quizQues.answers.find(
            (ans) => ans.id === quizAnswer.answerId
          );
          if (answer?.answer) {
            quesAnses.push({
              question: quizQues.question,
              answer: answer.answer
            });
          }
        }
      }
    }

    // Generate prompt
    const prompt = quizPrompt(quesAnses);

    // Them quiz question answer detail vao user log
    const quizQuesAnsDetail = new QuizQuesAnwsRequest({
      userId: userId,
      details: quizAnswers
    });

    const savedQuizQuesAnsResponse =
      await this.quizService.addQuizQuesAnws(quizQuesAnsDetail);

    if (!savedQuizQuesAnsResponse.success || !savedQuizQuesAnsResponse.data?.id) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to save quiz question answers',
        { userId }
      );
    }

    // Save user quiz log
    await this.logService.addQuizQuesAnsDetailToUserLog(
      userId,
      savedQuizQuesAnsResponse.data.id
    );

    // Get AI response
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      prompt,
      QUIZ_SYSTEM_PROMPT,
      Output.object(searchOutput)
    );

    // Return response
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId, service: 'AIService' }
      );
    }

    return Ok(aiResponse.data);
  }

  /** Trả lời quiz và nhận gợi ý nước hoa từ AI */
  @Public()
  @Post('user/v2')
  @ApiOperation({ summary: 'Trả lời quiz và nhận gợi ý AI' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [QuizQuesAnsDetailRequest] })
  async chatQuizV2(
    @Query('userId') userId: string,
    @Body() quizAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    // Lay cau hoi quiz va cau tra loi tuong ung
    const questionIds = quizAnswers.map((qa) => qa.questionId);
    const quizQueses = await this.quizService.getQuizQuesByIdList(questionIds);
    if (!quizQueses.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get quiz question',
        { questionIds }
      );
    }

    // Map từng quizAnswer (questionId + answerId) sang cặp (question text + answer text)
    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (quizQueses.data) {
      for (const quizAnswer of quizAnswers) {
        const quizQues = quizQueses.data.find((q) => q.id === quizAnswer.questionId);
        if (quizQues?.answers && quizQues.question) {
          const answer = quizQues.answers.find(
            (ans) => ans.id === quizAnswer.answerId
          );
          if (answer?.answer) {
            quesAnses.push({
              question: quizQues.question,
              answer: answer.answer
            });
          }
        }
      }
    }

    // Generate prompt
    const prompt = quizPrompt(quesAnses);

    // Add job to queue
    await this.quizQueue.add(QuizJobName.ADD_QUIZ_QUESTION_AND_ANSWER, {
      userId,
      details: quizAnswers
    });

    // Get AI response
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      prompt,
      QUIZ_SYSTEM_PROMPT,
      Output.object(searchOutput)
    );

    // Return response
    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId, service: 'AIService' }
      );
    }

    return Ok(aiResponse.data);
  }

  /** Lấy tất cả câu hỏi và câu trả lời quiz của người dùng */
  @Public()
  @Get('user/:userId')
  @ApiOperation({
    summary: 'Lấy tất cả câu hỏi và câu trả lời quiz của người dùng'
  })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(QuizQuestionAnswerResponse)
  async getQuizQuesAnwsByUserId(
    @Param('userId') userId: string
  ): Promise<BaseResponse<QuizQuestionAnswerResponse>> {
    return this.quizService.getQuizQuesAnwsByUserId(userId);
  }

  /** Xóa mềm câu hỏi quiz (isActive = false) */
  @Role(['admin'])
  @Delete('questions/:id')
  @ApiOperation({ summary: 'Xóa câu hỏi quiz (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi cần xóa' })
  @ApiBaseResponse(Boolean)
  async deleteQuizQuestion(
    @Param('id') id: string
  ): Promise<BaseResponse<void>> {
    const result = await this.quizService.softDeleteQuestion(id);
    if (!result.success) {
      throw new BadRequestWithDetailsException(
        result.error ?? 'Quiz question not found or already deleted',
        { questionId: id }
      );
    }
    return Ok();
  }
}
