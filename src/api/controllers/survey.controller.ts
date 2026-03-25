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
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuesAnsDetailRequest } from 'src/application/dtos/request/survey-ques-ans-detail.request';
import { SurveyQuesAnwsRequest } from 'src/application/dtos/request/survey-ques-ans.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { SurveyQuestionResponse } from 'src/application/dtos/response/survey-question.response';
import { SurveyService } from 'src/infrastructure/servicies/survey.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { BadRequestWithDetailsException, InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Surveys')
@Controller('surveys')
export class SurveyController {
  constructor(private surveyService: SurveyService) {}

  /** Lấy tất cả câu hỏi survey */
  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi survey' })
  @ApiBaseResponse(SurveyQuestionResponse, true)
  @CacheTTL(1)
  @UseInterceptors(CacheInterceptor)
  async getAllSurveys(): Promise<BaseResponse<SurveyQuestionResponse[]>> {
    const surveyQues = await this.surveyService.getAllSurveyQues();

    if (!surveyQues.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get survey questions',
        { service: 'SurveyService' }
      );
    }

    return Ok(surveyQues.data);
  }

  /** Lấy câu hỏi survey theo ID */
  @Public()
  @Get('questions/:id')
  @ApiOperation({ summary: 'Lấy câu hỏi survey theo ID' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiBaseResponse(SurveyQuestionResponse)
  @CacheTTL(1)
  @UseInterceptors(CacheInterceptor)
  async getSurveyQuesById(
    @Param('id') id: string
  ): Promise<BaseResponse<SurveyQuestionResponse>> {
    return this.surveyService.getSurveyQuesById(id);
  }

  /** Tạo câu hỏi survey mới */
  @Role(['admin'])
  @Post('questions')
  @ApiOperation({ summary: 'Tạo câu hỏi survey mới' })
  @ApiBaseResponse(String)
  async createSurveyQues(
    @Body() surveyQuestionRequest: SurveyQuestionRequest
  ): Promise<BaseResponse<string>> {
    return this.surveyService.addSurveyQues(surveyQuestionRequest);
  }

  /** Kiểm tra người dùng đã làm survey lần đầu chưa */
  @Public()
  @Get('user/:userId/check-first-time')
  @ApiOperation({ summary: 'Kiểm tra người dùng đã làm survey lần đầu chưa' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(Boolean)
  async checkFirstTime(
    @Param('userId') userId: string
  ): Promise<BaseResponse<boolean>> {
    const isFirstTime =
      await this.surveyService.checkExistSurveyQuesAnwsByUserId(userId);
    return Ok(isFirstTime);
  }

  /** Tạo nhiều câu hỏi survey cùng lúc */
  @Public()
  @Post('questions/list')
  @ApiOperation({ summary: 'Tạo nhiều câu hỏi survey cùng lúc' })
  @ApiBody({ type: [SurveyQuestionRequest] })
  @ApiBaseResponse(String)
  async createSurveyQueses(
    @Body() surveyQuestionRequest: SurveyQuestionRequest[]
  ): Promise<BaseResponse<void>> {
    for (const surveyQuestion of surveyQuestionRequest) {
      await this.surveyService.addSurveyQues(surveyQuestion);
    }
    return Ok();
  }

  /** Cập nhật câu hỏi survey (nội dung, loại và/hoặc câu trả lời) */
  @Role(['admin'])
  @Put('questions/:id')
  @ApiOperation({ summary: 'Cập nhật câu hỏi survey (questionType và/hoặc answers)' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiBody({ type: SurveyQuestionRequest })
  @ApiBaseResponse(SurveyQuestionResponse)
  async updateSurveyAnswer(
    @Param('id') id: string,
    @Body() surveyQuestionRequest: SurveyQuestionRequest
  ): Promise<BaseResponse<SurveyQuestionResponse>> {
    return this.surveyService.updateAnswer(id, surveyQuestionRequest);
  }

  /** Trả lời survey và nhận gợi ý nước hoa từ AI */
  @Public()
  @Post('user')
  @ApiOperation({ summary: 'Trả lời survey và nhận gợi ý AI' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurvey(
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    return this.surveyService.processSurveyAndGetAIResponse(userId, surveyAnswers);
  }

  /** Trả lời survey và nhận gợi ý nước hoa từ AI */
  @Public()
  @Post('user/v2')
  @ApiOperation({ summary: 'Trả lời survey và nhận gợi ý AI' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurveyV2(
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    return this.surveyService.processSurveyV2AndGetAIResponse(userId, surveyAnswers);
  }

  /** Lấy tất cả câu hỏi và câu trả lời survey của người dùng */
  @Public()
  @Get('user/:userId')
  @ApiOperation({
    summary: 'Lấy tất cả câu hỏi và câu trả lời survey của người dùng'
  })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(SurveyQuestionAnswerResponse)
  async getSurveyQuesAnwsByUserId(
    @Param('userId') userId: string
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse>> {
    return this.surveyService.getSurveyQuesAnwsByUserId(userId);
  }

  /** Xóa mềm câu hỏi survey (isActive = false) */
  @Role(['admin'])
  @Delete('questions/:id')
  @ApiOperation({ summary: 'Xóa câu hỏi survey (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID câu hỏi cần xóa' })
  @ApiBaseResponse(Boolean)
  async deleteSurveyQuestion(
    @Param('id') id: string
  ): Promise<BaseResponse<void>> {
    const result = await this.surveyService.softDeleteQuestion(id);
    if (!result.success) {
      throw new BadRequestWithDetailsException(
        result.error ?? 'Survey question not found or already deleted',
        { questionId: id }
      );
    }
    return Ok();
  }
}
