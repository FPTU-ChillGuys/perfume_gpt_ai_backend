import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiExtraModels
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { SurveyQuesAnsDetailRequest } from 'src/application/dtos/request/survey-ques-ans-detail.request';
import { SurveyQuesAnwsRequest } from 'src/application/dtos/request/survey-ques-ans.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { SurveyQuestionResponse } from 'src/application/dtos/response/survey-question.response';
import { SurveyService } from 'src/infrastructure/domain/survey/survey.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';
import { ReorderQuestionsRequest } from 'src/application/dtos/request/reorder-questions.request';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { BadRequestWithDetailsException, InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Request } from 'express';
import { SurveyAttributeService } from 'src/infrastructure/domain/survey/survey-attribute.service';
import { SurveyInputHelper } from 'src/infrastructure/domain/survey/helpers/survey-input.helper';
import {
  SurveyAttributeType,
  CreateQuestionFromAttributeRequest,
  SurveyAttributeValuesResponse,
  SurveyAttributeTypeInfo,
  QueryFragmentMatch,
  QueryFragmentAttribute,
  QueryFragmentBudget
} from 'src/infrastructure/domain/survey/survey-query.types';

@ApiTags('Surveys')
@ApiExtraModels(QueryFragmentMatch, QueryFragmentAttribute, QueryFragmentBudget)
@Controller('surveys')
export class SurveyController {
  constructor(
    private surveyService: SurveyService,
    private surveyAttributeService: SurveyAttributeService,
    private inputHelper: SurveyInputHelper
  ) { }

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

  /** Trả lời survey và nhận gợi ý nước hoa từ AI (v5 - Hybrid AI + Query fragments + Ranking score) */
  @Public()
  @Post('user/v5')
  @ApiOperation({ summary: 'Trả lời survey V5 — Hybrid (AI phân tích + Query-based + Ranking score)' })
  @ApiQuery({ name: 'userId', type: String, required: false, description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurveyV5(
    @Req() req: Request,
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const resolvedUserId = this.inputHelper.resolveUserId(req, userId);
    return this.surveyService.processSurveyV5Hybrid(resolvedUserId, surveyAnswers);
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══  ATTRIBUTE ENDPOINTS (cho admin tạo survey query-based) ═══
  // ═══════════════════════════════════════════════════════════════

  /** Lấy danh sách tất cả loại thuộc tính có thể dùng cho survey */
  @Public()
  @Get('attributes')
  @ApiBaseResponse(SurveyAttributeTypeInfo, true)
  @ApiOperation({ summary: 'Lấy danh sách loại thuộc tính cho survey' })
  async getAttributeTypes(): Promise<BaseResponse<SurveyAttributeTypeInfo[]>> {
    return Ok(this.surveyAttributeService.getAvailableAttributeTypes());
  }

  /** Lấy tất cả giá trị của 1 loại thuộc tính */
  @Public()
  @Get('attributes/:type/values')
  @ApiOperation({ summary: 'Lấy giá trị của 1 loại thuộc tính' })
  @ApiParam({ name: 'type', description: 'Loại thuộc tính (gender, brand, category, origin, concentration, note, family, attribute, budget)' })
  @ApiBaseResponse(SurveyAttributeValuesResponse, true)
  async getAttributeValues(
    @Param('type') type: SurveyAttributeType
  ): Promise<BaseResponse<SurveyAttributeValuesResponse>> {
    try {
      const result = await this.surveyAttributeService.getAttributeValues(type);
      return Ok(result);
    } catch (error: any) {
      throw new BadRequestWithDetailsException(
        error.message || `Cannot get values for type: ${type}`,
        { type }
      );
    }
  }

  /** Tạo câu hỏi survey từ thuộc tính (tự động sinh câu trả lời query-based) */
  @Role(['admin'])
  @Post('questions/from-attribute')
  @ApiOperation({ summary: 'Tạo câu hỏi survey từ thuộc tính (auto-generate query answers)' })
  @ApiBaseResponse(String)
  async createQuestionFromAttribute(
    @Body() body: CreateQuestionFromAttributeRequest
  ): Promise<BaseResponse<string>> {
    return this.surveyService.createQuestionFromAttribute(body);
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

  /** Lấy danh sách lịch sử tất cả các lần trả lời survey của người dùng */
  @Public()
  @Get('user/:userId/history')
  @ApiOperation({
    summary: 'Lấy danh sách lịch sử tất cả các lần trả lời survey của người dùng'
  })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(SurveyQuestionAnswerResponse, true)
  async getSurveyHistoryListByUserId(
    @Param('userId') userId: string
  ): Promise<BaseResponse<SurveyQuestionAnswerResponse[]>> {
    return this.surveyService.getSurveyHistoryListByUserId(userId);
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

  @Role(['admin'])
  @Patch('questions/reorder')
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự câu hỏi survey' })
  @ApiBody({ type: ReorderQuestionsRequest })
  @ApiBaseResponse(Object)
  @HttpCode(HttpStatus.OK)
  async reorderQuestions(
    @Body() body: ReorderQuestionsRequest
  ): Promise<BaseResponse<void>> {
    return this.surveyService.reorderQuestions(body.orders.map(o => ({ id: o.id, order: o.order })));
  }
}
