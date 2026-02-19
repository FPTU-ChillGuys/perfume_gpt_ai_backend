import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { Output, UIMessage } from 'ai';
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import {
  ConversationDto,
  ConversationRequestDto
} from 'src/application/dtos/common/conversation.dto';
import { PagedConversationRequest } from 'src/application/dtos/request/paged-conversation.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import {
  ADVANCED_MATCHING_SYSTEM_PROMPT,
  INSTRUCTION_TYPE_CONVERSATION
} from 'src/application/constant/prompts';
import {
  userLogPrompt,
  orderReportPrompt,
  conversationSystemPrompt
} from 'src/application/constant/prompts';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import {
  extractTokenFromHeader,
  getTokenPayloadFromRequest
} from 'src/infrastructure/utils/extract-token';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/utils/message-helper';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import {
  buildCombinedPromptV1,
  buildCombinedPromptV2
} from 'src/infrastructure/utils/prompt-builder';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConversationJobName,
  QueueName
} from 'src/application/constant/processor';
import { Queue } from 'bullmq';

@ApiTags('Conversation')
@Controller('conversation')
export class ConversationController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private conversationService: ConversationService,
    private logService: UserLogService,
    private orderService: OrderService,
    private profileService: ProfileService,
    private adminInstructionService: AdminInstructionService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE)
    private readonly conversationQueue: Queue
  ) {}

  /** Lấy tất cả cuộc hội thoại */
  @Role('admin')
  @Get()
  @ApiOperation({ summary: 'Lấy tất cả cuộc hội thoại' })
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }

  /** Lấy cuộc hội thoại theo ID */
  @Role('admin')
  @Get(':id')
  @ApiOperation({ summary: 'Lấy cuộc hội thoại theo ID' })
  @ApiQuery({ name: 'id', type: String })
  async getConversationById(
    @Query('id') id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await this.conversationService.getConversationById(id);
  }

  /** Lấy danh sách cuộc hội thoại có phân trang (cải thiện so với getAllConversations) */
  @Role('admin')
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
   * @note userId được lấy từ JWT token. Guest (không có token) sẽ không lấy log/order/profile.
   */
  @Public()
  @Post('chat/v1')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V1 - Dùng log tóm tắt (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV1(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const userId = getTokenPayloadFromRequest(request)?.id;
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    //---------------------V1-------------------------------------
    let combinedPrompt = '';

    if (userId) {
      // Đã đăng nhập - lấy log tóm tắt + order + profile
      const userLog =
        await this.logService.getUserLogSummaryReportByUserId(userId);
      const userLogPromptText = userLogPrompt(userLog.data ?? '');

      const orderReport =
        await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
          userId,
          extractTokenFromHeader(request) ?? ''
        );

      const profile = await this.profileService.getOwnProfile(
        extractTokenFromHeader(request) ?? ''
      );

      const profileReport =
        await this.profileService.createSystemPromptFromProfile(
          profile.payload!
        );

      combinedPrompt = `${userLogPromptText}\n\n
      Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
      Profile:\n${profileReport ?? ''}`;
    }
    // Guest: không lấy log, order, profile
    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt),
      Output.object(searchOutput)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          conversationId: conversation.id,
          service: 'AIService',
          endpoint: 'chat/v1'
        }
      );
    }

    // Prepare response conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      userId || '',
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
   * @note userId được lấy từ JWT token. Guest (không có token) sẽ không lấy log/order/profile.
   */
  @Public()
  @Post('chat/v2')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V2 - Dùng log chi tiết (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV2(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const userId = getTokenPayloadFromRequest(request)?.id;
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    //---------------------V2-------------------------------------
    let combinedPrompt = '';

    if (userId) {
      // Đã đăng nhập - lấy log chi tiết + order + profile
      const userLogResponse =
        await this.logService.getReportAndPromptSummaryUserLogs({
          userId: userId,
          period: PeriodEnum.MONTHLY,
          endDate: convertToUTC(new Date()),
          startDate: undefined
        });

      const orderReport =
        await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
          userId,
          extractTokenFromHeader(request) ?? ''
        );

      const profile = await this.profileService.getOwnProfile(
        extractTokenFromHeader(request) ?? ''
      );

      const profileReport =
        await this.profileService.createSystemPromptFromProfile(
          profile.payload!
        );

      combinedPrompt = `${userLogResponse.data ? userLogResponse.data.response : ''}\n\n
      Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
      Profile:\n${profileReport ?? ''}`;
    }
    // Guest: không lấy log, order, profile
    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt),
      Output.object(searchOutput)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          conversationId: conversation.id,
          service: 'AIService',
          endpoint: 'chat/v2'
        }
      );
    }

    // Prepare response conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      userId || '',
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
   * @note Nếu có Bearer token → lấy userId + profile + order. Không có token (guest) → không lấy log.
   */
  @Public()
  @Post('test/v1')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Test V1 - Log tóm tắt (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async convserationV1Test(
    @Req() request: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const userId = getTokenPayloadFromRequest(request)?.id;

    // -----------------------------Test V1 -------------------------------------
    let combinedPrompt = '';

    if (userId) {
      // Đã đăng nhập - lấy log tóm tắt + order + profile
      const userLog = await this.logService.getUserLogSummaryReportByUserId(
        userId,
        new Date(0),
        convertToUTC(new Date())
      );

      console.log('User log data:', userLog.data);

      const userLogPromptText = userLogPrompt(userLog.data ?? '');

      const orderReport =
        await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
          userId,
          extractTokenFromHeader(request) ?? ''
        );

      const profile = await this.profileService.getOwnProfile(
        extractTokenFromHeader(request) ?? ''
      );

      const profileReport =
        await this.profileService.createSystemPromptFromProfile(
          profile.payload!
        );

      combinedPrompt = `${userLogPromptText}\n\n
      Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
      Profile:\n${profileReport ?? ''}`;
    }
    // Guest: không lấy log, order, profile
    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          service: 'AIService',
          endpoint: 'test/v1'
        }
      );
    }

    return {
      success: true,
      data: message.data
    };
  }

  /**
   * Test V2 - Test hội thoại với user log chi tiết
   * @note Nếu có Bearer token → lấy userId + profile + order. Không có token (guest) → không lấy log.
   */
  @Public()
  @Post('test/v2')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Test V2 - Log chi tiết (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async convserationV2Test(
    @Req() request: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const userId = getTokenPayloadFromRequest(request)?.id;

    // -----------------------------Test V2 -------------------------------------
    let combinedPrompt = '';

    if (userId) {
      // Đã đăng nhập - lấy log chi tiết + order + profile
      const userLogResponse =
        await this.logService.getReportAndPromptSummaryUserLogs({
          userId: userId,
          period: PeriodEnum.MONTHLY,
          endDate: convertToUTC(new Date()),
          startDate: undefined
        });

      const orderReport =
        await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
          userId,
          extractTokenFromHeader(request) ?? ''
        );

      const profile = await this.profileService.getOwnProfile(
        extractTokenFromHeader(request) ?? ''
      );

      const profileReport =
        await this.profileService.createSystemPromptFromProfile(
          profile.payload!
        );

      combinedPrompt = `${userLogResponse.data ? userLogResponse.data.response : ''}\n\n
      Order Report:\n${orderReportPrompt(orderReport.data ?? '')}\n\n
      Profile:\n${profileReport ?? ''}`;
    }
    // Guest: không lấy log, order, profile
    //-------------------------------------------------------------

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(ADVANCED_MATCHING_SYSTEM_PROMPT, combinedPrompt)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          service: 'AIService',
          endpoint: 'test/v2'
        }
      );
    }

    return {
      success: true,
      data: message.data
    };
  }

  /**
   * Test V3 - Test hội thoại dùng common helper (tương tự chat V3)
   * Sử dụng buildCombinedPromptV1 helper, giảm code trùng lặp.
   * @note Nếu có Bearer token → lấy userId + profile + order. Không có token (guest) → không lấy log.
   */
  @Public()
  @Post('test/v3')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Test V3 - Common helper + log tóm tắt (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(String)
  async conversationV3Test(
    @Req() request: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const userId = getTokenPayloadFromRequest(request)?.id;

    const promptResult = await buildCombinedPromptV1(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          service: 'PromptBuilder',
          endpoint: 'test/v3'
        }
      );
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          service: 'AIService',
          endpoint: 'test/v3'
        }
      );
    }

    return Ok(message.data);
  }

  /**
   * Test V4 - Test hội thoại dùng common helper (tương tự chat V4)
   * Sử dụng buildCombinedPromptV2 helper, giảm code trùng lặp.
   * @note Nếu có Bearer token → lấy userId + profile + order. Không có token (guest) → không lấy log.
   */
  @Public()
  @Post('test/v4')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Test V4 - Common helper + log chi tiết (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiQuery({
    name: 'prompt',
    type: String,
    description: 'Nội dung tin nhắn test'
  })
  @ApiBaseResponse(String)
  async conversationV4Test(
    @Req() request: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const userId = getTokenPayloadFromRequest(request)?.id;

    const promptResult = await buildCombinedPromptV2(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          service: 'PromptBuilder',
          endpoint: 'test/v4'
        }
      );
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          service: 'AIService',
          endpoint: 'test/v4'
        }
      );
    }

    return Ok(message.data);
  }

  /**
   * Chat V3 - Phiên bản cải thiện dùng common helper, giảm code trùng lặp.
   * Logic tương tự V1 nhưng sử dụng buildCombinedPromptV1 helper.
   * @note userId được lấy từ JWT token. Guest (không có token) sẽ không lấy log/order/profile.
   */
  @Public()
  @Post('chat/v3')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V3 - Common helper + log tóm tắt (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV3(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const userId = getTokenPayloadFromRequest(request)?.id;
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV1(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          conversationId: conversation.id,
          service: 'PromptBuilder',
          endpoint: 'chat/v3'
        }
      );
    }

    // Call AI service
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      ),
      Output.object(searchOutput)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          conversationId: conversation.id,
          service: 'AIService',
          endpoint: 'chat/v3'
        }
      );
    }

    // Lưu conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    await this.conversationService.saveOrUpdateConversation(
      responseConversation
    );

    return Ok(responseConversation);
  }

  /**
   * Chat V4 - Phiên bản cải thiện dùng common helper, giảm code trùng lặp.
   * Logic tương tự V2 nhưng sử dụng buildCombinedPromptV2 helper.
   * @note userId được lấy từ JWT token. Guest (không có token) sẽ không lấy log/order/profile.
   */
  @Public()
  @Post('chat/v4')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V4 - Common helper + log chi tiết (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV4(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const userId = getTokenPayloadFromRequest(request)?.id;
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV2(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          conversationId: conversation.id,
          service: 'PromptBuilder',
          endpoint: 'chat/v4'
        }
      );
    }

    // Call AI service
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      ),
      Output.object(searchOutput)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          conversationId: conversation.id,
          service: 'AIService',
          endpoint: 'chat/v4'
        }
      );
    }

    // Lưu conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    await this.conversationService.saveOrUpdateConversation(
      responseConversation
    );

    return Ok(responseConversation);
  }

  /**
   * Chat V5 - Dựa trên V4 nhưng sử dụng nestjs/bull để xử lý log và AI response trong background job, tránh timeout cho user.
   * Logic tương tự V2 nhưng sử dụng buildCombinedPromptV2 helper.
   * @note userId được lấy từ JWT token. Guest (không có token) sẽ không lấy log/order/profile.
   */
  @Public()
  @Post('chat/v5')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V5 - Common helper + log chi tiết (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV5(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const userId =
      getTokenPayloadFromRequest(request)?.id ?? conversation.userId;
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV2(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          conversationId: conversation.id,
          service: 'PromptBuilder',
          endpoint: 'chat/v4'
        }
      );
    }

    // Call AI service
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      ),
      Output.object(searchOutput)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          conversationId: conversation.id,
          service: 'AIService',
          endpoint: 'chat/v4'
        }
      );
    }

    // Lưu conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      userId || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    await this.conversationQueue.add(
      ConversationJobName.ADD_MESSAGE_AND_LOG,
      responseConversation  
    );

    // await this.conversationService.saveOrUpdateConversation(responseConversation);

    return Ok(responseConversation);
  }

  /**
   * Test V1 - Bảo vệ bằng role admin.
   * Endpoint test chỉ dành cho admin, tránh lộ ra production.
   * @note userId được lấy từ JWT token.
   */
  @Post('test/guarded/v1')
  @Role('admin')
  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description: 'Token JWT không hợp lệ hoặc không được cung cấp'
  })
  @ApiForbiddenResponse({ description: 'Yêu cầu role: admin' })
  @ApiOperation({
    summary: 'Test Guarded V1 - Admin only (userId lấy từ token)'
  })
  @ApiQuery({ name: 'prompt', type: String })
  @ApiBaseResponse(String)
  async guardedTestV1(
    @Req() request: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const userId = getTokenPayloadFromRequest(request)?.id;

    const promptResult = await buildCombinedPromptV1(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          service: 'PromptBuilder',
          endpoint: 'test/guarded/v1'
        }
      );
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          service: 'AIService',
          endpoint: 'test/guarded/v1'
        }
      );
    }

    return Ok(message.data);
  }

  /**
   * Test V2 - Bảo vệ bằng role admin.
   * Endpoint test chỉ dành cho admin, tránh lộ ra production.
   * @note userId được lấy từ JWT token.
   */
  @Post('test/guarded/v2')
  @Role('admin')
  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description: 'Token JWT không hợp lệ hoặc không được cung cấp'
  })
  @ApiForbiddenResponse({ description: 'Yêu cầu role: admin' })
  @ApiOperation({
    summary: 'Test Guarded V2 - Admin only (userId lấy từ token)'
  })
  @ApiQuery({ name: 'prompt', type: String })
  @ApiBaseResponse(String)
  async guardedTestV2(
    @Req() request: Request,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const userId = getTokenPayloadFromRequest(request)?.id;

    const promptResult = await buildCombinedPromptV2(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userId,
      extractTokenFromHeader(request) ?? ''
    );

    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId,
          service: 'PromptBuilder',
          endpoint: 'test/guarded/v2'
        }
      );
    }

    const message = await this.aiService.textGenerateFromPrompt(
      prompt,
      conversationSystemPrompt(
        ADVANCED_MATCHING_SYSTEM_PROMPT,
        promptResult.data.combinedPrompt
      )
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        {
          userId,
          service: 'AIService',
          endpoint: 'test/guarded/v2'
        }
      );
    }

    return Ok(message.data);
  }
}
