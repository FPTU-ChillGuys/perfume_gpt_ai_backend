import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  ApiTags
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuesAnsDetailRequest } from 'src/application/dtos/request/survey-ques-ans-detail.request';
import { SurveyQuesAnwsRequest } from 'src/application/dtos/request/survey-ques-ans.request';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { SurveyQuestionResponse } from 'src/application/dtos/response/survey-question.response';
import { SurveyService } from 'src/infrastructure/domain/survey/survey.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { BadRequestWithDetailsException, InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Request } from 'express';
import { resolveLogUserIdFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { SurveyAttributeService } from 'src/infrastructure/domain/survey/survey-attribute.service';
import { SurveyQueryValidatorService } from 'src/infrastructure/domain/survey/survey-query-validator.service';
import { SurveyAttributeType, CreateQuestionFromAttributeRequest } from 'src/infrastructure/domain/survey/survey-query.types';

@ApiTags('Surveys')
@Controller('surveys')
export class SurveyController {
  constructor(
    private surveyService: SurveyService,
    private surveyAttributeService: SurveyAttributeService,
    private surveyQueryValidator: SurveyQueryValidatorService
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

  /** Trả lời survey và nhận gợi ý nước hoa từ AI */
  @Public()
  @Post('user')
  @ApiOperation({ summary: 'Trả lời survey và nhận gợi ý AI' })
  @ApiQuery({ name: 'userId', type: String, required: false, description: 'ID của người dùng (optional, fallback from request fingerprint)' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurvey(
    @Req() req: Request,
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const resolvedUserId = userId || resolveLogUserIdFromRequest(req);
    return this.surveyService.processSurveyAndGetAIResponse(resolvedUserId, surveyAnswers);
  }

  /** Trả lời survey và nhận gợi ý nước hoa từ AI */
  @Public()
  @Post('user/v2')
  @ApiOperation({ summary: 'Trả lời survey và nhận gợi ý AI (v2 - monolithic query)' })
  @ApiQuery({ name: 'userId', type: String, required: false, description: 'ID của người dùng (optional, fallback from request fingerprint)' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurveyV2(
    @Req() req: Request,
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const resolvedUserId = userId || resolveLogUserIdFromRequest(req);
    return this.surveyService.processSurveyV2AndGetAIResponse(resolvedUserId, surveyAnswers);
  }

  /** Trả lời survey và nhận gợi ý nước hoa từ AI (v3 - per-question query decomposition) */
  @Public()
  @Post('user/v3')
  @ApiOperation({ summary: 'Trả lời survey và nhận gợi ý AI (v3 - per-question query, skip 0 products)' })
  @ApiQuery({ name: 'userId', type: String, required: false, description: 'ID của người dùng (optional, fallback from request fingerprint)' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurveyV3(
    @Req() req: Request,
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const resolvedUserId = userId || resolveLogUserIdFromRequest(req);
    return this.surveyService.processSurveyWithPerQuestionQueries(resolvedUserId, surveyAnswers);
  }

  /** Survey V4 — query-based processing (câu trả lời chứa sẵn JSON query) */
  @Public()
  @Post('user/v4')
  @ApiOperation({ summary: 'Trả lời survey V4 — query-based (no AI analysis, trực tiếp query sản phẩm)' })
  @ApiQuery({ name: 'userId', type: String, required: false, description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  @ApiBody({ type: [SurveyQuesAnsDetailRequest] })
  async chatSurveyV4(
    @Req() req: Request,
    @Query('userId') userId: string,
    @Body() surveyAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {
    const resolvedUserId = userId || resolveLogUserIdFromRequest(req);
    return this.surveyService.processSurveyV4QueryBased(resolvedUserId, surveyAnswers);
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══  ATTRIBUTE ENDPOINTS (cho admin tạo survey query-based) ═══
  // ═══════════════════════════════════════════════════════════════

  /** Lấy danh sách tất cả loại thuộc tính có thể dùng cho survey */
  @Public()
  @Get('attributes')
  @ApiOperation({ summary: 'Lấy danh sách loại thuộc tính cho survey' })
  async getAttributeTypes(): Promise<BaseResponse<any>> {
    return Ok(this.surveyAttributeService.getAvailableAttributeTypes());
  }

  /** Lấy tất cả giá trị của 1 loại thuộc tính */
  @Public()
  @Get('attributes/:type/values')
  @ApiOperation({ summary: 'Lấy giá trị của 1 loại thuộc tính' })
  @ApiParam({ name: 'type', description: 'Loại thuộc tính (gender, brand, category, origin, concentration, note, family, attribute, budget)' })
  async getAttributeValues(
    @Param('type') type: SurveyAttributeType
  ): Promise<BaseResponse<any>> {
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
    // 1. Get values for the attribute type
    const attrValues = await this.surveyAttributeService.getAttributeValues(body.attributeType);

    // 2. Collect all value items
    let allValues = attrValues.values || [];

    // Handle subGroups for 'attribute' type
    if (body.attributeType === 'attribute' && attrValues.subGroups) {
      if (body.attributeName) {
        const group = attrValues.subGroups.find(g => g.attributeName === body.attributeName);
        allValues = group?.values || [];
      } else {
        throw new BadRequestWithDetailsException(
          'attributeName is required when attributeType is "attribute"',
          { attributeType: body.attributeType }
        );
      }
    }

    // Handle budget type with custom ranges
    if (body.attributeType === 'budget' && body.budgetRanges && body.budgetRanges.length > 0) {
      allValues = body.budgetRanges.map(r => ({
        displayText: r.label,
        queryFragment: { type: 'budget' as const, min: r.min, max: r.max },
      }));
    }

    // 3. Filter selected values if specified
    if (body.selectedValues && body.selectedValues.length > 0) {
      const selectedSet = new Set(body.selectedValues);
      allValues = allValues.filter(v => selectedSet.has(v.displayText));
    }

    if (allValues.length < 2) {
      throw new BadRequestWithDetailsException(
        'Cần ít nhất 2 giá trị để tạo câu hỏi',
        { availableValues: allValues.length }
      );
    }

    // 4. Validate all query fragments  
    for (const val of allValues) {
      const validation = this.surveyQueryValidator.validateQueryFragment(val.queryFragment);
      if (!validation.valid) {
        throw new BadRequestWithDetailsException(
          `Invalid query fragment for "${val.displayText}": ${validation.errors.join(', ')}`,
          { displayText: val.displayText, errors: validation.errors }
        );
      }
    }

    // 5. Build survey question request with JSON answers
    const surveyQuestionReq: SurveyQuestionRequest = {
      question: body.question,
      questionType: body.questionType as any,
      answers: allValues.map(val => new SurveyAnswerRequest({
        answer: JSON.stringify({
          displayText: val.displayText,
          queryFragment: val.queryFragment,
        }),
      })),
    };

    return this.surveyService.addSurveyQues(surveyQuestionReq);
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
}
