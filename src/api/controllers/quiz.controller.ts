import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors
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
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { QuizQuestionAnswerResponse } from 'src/application/dtos/response/quiz-question-answer.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { BadRequestWithDetailsException, InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizController {
  constructor(private quizService: QuizService) {}

  /** Lấy tất cả câu hỏi quiz */
  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi quiz' })
  @ApiBaseResponse(QuizQuestionResponse, true)
  @CacheTTL(1)
  @UseInterceptors(CacheInterceptor)
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
  @CacheTTL(1)
  @UseInterceptors(CacheInterceptor)
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

  /** Cập nhật câu hỏi quiz (nội dung, loại và/hoặc câu trả lời) */
  @Role(['admin'])
  @Put('questions/:id')
  @ApiOperation({ summary: 'Cập nhật câu hỏi quiz (questionType và/hoặc answers)' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiBody({ type: QuizQuestionRequest })
  @ApiBaseResponse(QuizQuestionResponse)
  async updateQuizAnswer(
    @Param('id') id: string,
    @Body() quizQuestionRequest: QuizQuestionRequest
  ): Promise<BaseResponse<QuizQuestionResponse>> {
    return this.quizService.updateAnswer(id, quizQuestionRequest);
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
    return this.quizService.processQuizAndGetAIResponse(userId, quizAnswers);
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
    return this.quizService.processQuizV2AndGetAIResponse(userId, quizAnswers);
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
