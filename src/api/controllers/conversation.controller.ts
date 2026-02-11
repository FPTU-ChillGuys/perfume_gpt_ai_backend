import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Output, UIMessage } from 'ai';
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import {
  ConversationDto,
  ConversationRequestDto
} from 'src/application/dtos/common/conversation.dto';
import { PagedConversationRequest } from 'src/application/dtos/request/paged-conversation.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import { ADVANCED_MATCHING_SYSTEM_PROMPT } from 'src/application/constant/prompts';
import {
  userLogPrompt,
  orderReportPrompt,
  conversationSystemPrompt,
  conversationTestSystemPrompt
} from 'src/application/constant/prompts';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/utils/message-helper';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';
import {
  buildCombinedPromptV1,
  buildCombinedPromptV2
} from 'src/infrastructure/utils/chat-prompt-builder';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';

@ApiTags('Conversation')
@Controller('conversation')
export class ConversationController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private conversationService: ConversationService,
    private logService: UserLogService,
    private orderService: OrderService,
    private profileService: ProfileService,
    private adminInstructionService: AdminInstructionService
  ) {}

  /** Lấy tất cả cuộc hội thoại */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy tất cả cuộc hội thoại' })
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }

  /** Lấy cuộc hội thoại theo ID */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy cuộc hội thoại theo ID' })
  @ApiQuery({ name: 'id', type: String })
  async getConversationById(
    @Query('id') id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await this.conversationService.getConversationById(id);
  }

  /** Lấy danh sách cuộc hội thoại có phân trang (cải thiện so với getAllConversations) */
  @Public()
  @Get('list/paged')
  @ApiOperation({ summary: 'Lấy danh sách cuộc hội thoại có phân trang' })
  @ApiBaseResponse(PagedResult<ConversationDto>)
  async getAllConversationsPaginated(
    @Query() request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationDto>>> {
    return await this.conversationService.getAllConversationsPaginated(request);
  }

  /**
   * Chat V1 - Sử dụng log tóm tắt từ user log service (nhanh hơn nhưng phụ thuộc nội dung tóm tắt của service)
   * @note request dùng để lấy token xác thực, có thể chuyển sang axios interceptor
   */
  @Public()
  @Post('chat/v1')
  @ApiOperation({ summary: 'Chat V1 - Dùng log tóm tắt từ user log summary' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV1(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    //---------------------V1-------------------------------------
    // Lay log nguoi dung tu db trong khoan 1 thang
    /* 
      Cách này lấy log tóm tắt từ user log service (Nhanh hơn nhưng tùy thuộc nội dung tóm tắt của service)
    */
    const userLog = await this.logService.getUserLogSummaryReportByUserId(
      conversation.userId
    );

    // Tao prompt cho AI tu log nguoi dung
    const userLogPromptText = userLogPrompt(userLog.data ?? '');

    // Tam thoi lay order cua nguoi dung theo userID
    const orderReport =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        conversation.userId,
        extractTokenFromHeader(request) ?? ''
      );

    const profile = await this.profileService.getOwnProfile(
      extractTokenFromHeader(request) ?? ''
    );

    const profileReport =
      await this.profileService.createSystemPromptFromProfile(profile.payload!);

    // Ket hop prompt tu log nguoi dung va report don hang
    const combinedPrompt = `${userLogPromptText}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
    Profile:\n${profileReport ?? ''}`;

    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput),
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt)
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    // Prepare response conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      conversation.userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    // Save or update conversation in database
    if (
      !(await this.conversationService.isExistConversation(
        responseConversation.id || ''
      ))
    ) {
      await this.conversationService.addConversation(responseConversation);
    } else {
      await this.conversationService.updateMessageToConversation(
        responseConversation.id!,
        responseConversation.messages || []
      );
    }

    return {
      success: true,
      data: responseConversation
    };
  }

  /**
   * Chat V2 - Lấy log trực tiếp từ user log service (chậm hơn nhưng luôn đầy đủ nội dung)
   * @note request dùng để lấy token xác thực, có thể chuyển sang axios interceptor
   */
  @Public()
  @Post('chat/v2')
  @ApiOperation({ summary: 'Chat V2 - Dùng log chi tiết từ user log service' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV2(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    //---------------------V2-------------------------------------
    // Lay log nguoi dung tu db trong khoan 1 thang
    /* 
      Cách này lấy log trực tiếp từ user log service (Chậm hơn nhưng luôn đầy đủ nội dung)
    */
    const userLogResponse =
      await this.logService.getReportAndPromptSummaryUserLogs({
        userId: conversation.userId,
        period: PeriodEnum.MONTHLY,
        endDate: convertToUTC(new Date()),
        startDate: undefined
      });

    const orderReport =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        conversation.userId,
        extractTokenFromHeader(request) ?? ''
      );

    const profile = await this.profileService.getOwnProfile(
      extractTokenFromHeader(request) ?? ''
    );

    const profileReport =
      await this.profileService.createSystemPromptFromProfile(profile.payload!);

    // Ket hop prompt tu log nguoi dung va report don hang
    // Lay response tu user log service
    const combinedPrompt = `${userLogResponse.data ? userLogResponse.data.response : ''}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
    Profile:\n${profileReport ?? ''}`;

    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput),
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt)
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    // Prepare response conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      conversation.userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    // Luu hoac cap nhat conversation vao db
    if (
      !(await this.conversationService.isExistConversation(
        responseConversation.id || ''
      ))
    ) {
      await this.conversationService.addConversation(responseConversation);
    } else {
      await this.conversationService.updateMessageToConversation(
        responseConversation.id!,
        responseConversation.messages || []
      );
    }

    return {
      success: true,
      data: responseConversation
    };
  }

  /**
   * Test V1 - Test hội thoại với user log tóm tắt
   * @note request dùng để lấy token xác thực, có thể chuyển sang axios interceptor
   */
  @Public()
  @Post('test/v1')
  @ApiOperation({ summary: 'Test V1 - Test hội thoại với log tóm tắt' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async convserationV1Test(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    // -----------------------------Test V1 -------------------------------------
    // Lay log nguoi dung tu db trong khoan 1 thang
    const userLog = await this.logService.getUserLogSummaryReportByUserId(
      userId,
      new Date(0),
      convertToUTC(new Date())
    );

    console.log('User log data:', userLog.data);

    // Tao prompt cho AI tu log nguoi dung
    const userLogPromptText = userLogPrompt(userLog.data ?? '');

    // Tam thoi lay order cua nguoi dung theo userID
    const orderReport =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userId,
        extractTokenFromHeader(request) ?? ''
      );

    const profile = await this.profileService.getOwnProfile(
      extractTokenFromHeader(request) ?? ''
    );

    const profileReport =
      await this.profileService.createSystemPromptFromProfile(profile.payload!);

    const combinedPrompt = `${userLogPromptText}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
    Profile:\n${profileReport ?? ''}`;

    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt)
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return {
      success: true,
      data: message.data
    };
  }

  /**
   * Test V2 - Test hội thoại với user log chi tiết
   * @note request dùng để lấy token xác thực, có thể chuyển sang axios interceptor
   */
  @Public()
  @Post('test/v2')
  @ApiOperation({ summary: 'Test V2 - Test hội thoại với log chi tiết' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async convserationV2Test(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    // -----------------------------Test V1 -------------------------------------
    // Lay log nguoi dung tu db trong khoan 1 thang
    const userLogResponse =
      await this.logService.getReportAndPromptSummaryUserLogs({
        userId: userId,
        period: PeriodEnum.MONTHLY,
        endDate: convertToUTC(new Date()),
        startDate: undefined
      });

    // Tam thoi lay order cua nguoi dung theo userID
    const orderReport =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userId,
        extractTokenFromHeader(request) ?? ''
      );

    const profile = await this.profileService.getOwnProfile(
      extractTokenFromHeader(request) ?? ''
    );

    const profileReport =
      await this.profileService.createSystemPromptFromProfile(profile.payload!);

    const combinedPrompt = `${userLogResponse.data ? userLogResponse.data.response : ''}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
    Profile:\n${profileReport ?? ''}`;

    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt)
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return {
      success: true,
      data: message.data
    };
  }

  /**
   * Test V3 - Test hội thoại dùng common helper (tương tự V3)
   * Sử dụng buildCombinedPromptV1 helper, giảm code trùng lặp.
   */
  @Public()
  @Post('test/v3')
  @ApiOperation({ summary: 'Test V3 - Test hội thoại dùng common helper (cải thiện từ test V1)' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(String)
  async conversationV3Test(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV1(
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      return { success: false, error: 'Failed to build combined prompt' };
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: message.data };
  }

  /**
   * Test V4 - Test hội thoại dùng common helper (tương tự V4)
   * Sử dụng buildCombinedPromptV2 helper, giảm code trùng lặp.
   */
  @Public()
  @Post('test/v4')
  @ApiOperation({ summary: 'Test V4 - Test hội thoại dùng common helper (cải thiện từ test V2)' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(String)
  async conversationV4Test(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV2(
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      return { success: false, error: 'Failed to build combined prompt' };
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: message.data };
  }

  /**
   * Chat V3 - Phiên bản cải thiện dùng common helper, giảm code trùng lặp.
   * Logic tương tự V1 nhưng sử dụng buildCombinedPromptV1 helper.
   */
  @Public()
  @Post('chat/v3')
  @ApiOperation({ summary: 'Chat V3 - Dùng common helper (cải thiện từ V1)' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV3(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV1(
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      conversation.userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      return { success: false, error: 'Failed to build combined prompt' };
    }

    // Call AI service
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput),
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    // Lưu conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      conversation.userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    await this.saveOrUpdateConversation(responseConversation);

    return { success: true, data: responseConversation };
  }

  /**
   * Chat V4 - Phiên bản cải thiện dùng common helper, giảm code trùng lặp.
   * Logic tương tự V2 nhưng sử dụng buildCombinedPromptV2 helper.
   */
  @Public()
  @Post('chat/v4')
  @ApiOperation({ summary: 'Chat V4 - Dùng common helper (cải thiện từ V2)' })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV4(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV2(
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      conversation.userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      return { success: false, error: 'Failed to build combined prompt' };
    }

    // Call AI service
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput),
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    // Lưu conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      conversation.userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    await this.saveOrUpdateConversation(responseConversation);

    return { success: true, data: responseConversation };
  }

  /**
   * Test V1 - Bảo vệ bằng role admin.
   * Endpoint test chỉ dành cho admin, tránh lộ ra production.
   */
  @Post('test/guarded/v1')
  @Role('admin')
  @ApiOperation({ summary: 'Test V1 có xác thực role admin' })
  @ApiQuery({ name: 'userId', type: String })
  @ApiQuery({ name: 'prompt', type: String })
  @ApiBaseResponse(String)
  async guardedTestV1(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV1(
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      return { success: false, error: 'Failed to build combined prompt' };
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: message.data };
  }

  /**
   * Test V2 - Bảo vệ bằng role admin.
   * Endpoint test chỉ dành cho admin, tránh lộ ra production.
   */
  @Post('test/guarded/v2')
  @Role('admin')
  @ApiOperation({ summary: 'Test V2 có xác thực role admin' })
  @ApiQuery({ name: 'userId', type: String })
  @ApiQuery({ name: 'prompt', type: String })
  @ApiBaseResponse(String)
  async guardedTestV2(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV2(
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      return { success: false, error: 'Failed to build combined prompt' };
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: message.data };
  }

  /**
   * Helper: Lưu hoặc cập nhật conversation vào DB.
   * Giảm code trùng lặp giữa các endpoint chat.
   */
  private async saveOrUpdateConversation(
    conversation: ConversationDto
  ): Promise<void> {
    if (
      !(await this.conversationService.isExistConversation(
        conversation.id || ''
      ))
    ) {
      await this.conversationService.addConversation(conversation);
    } else {
      await this.conversationService.updateMessageToConversation(
        conversation.id!,
        conversation.messages || []
      );
    }
  }
}
