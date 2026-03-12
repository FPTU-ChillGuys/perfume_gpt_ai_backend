import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,

} from '@nestjs/swagger';
import { Output, pipeUIMessageStreamToResponse, UIMessage } from 'ai';
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import {
  ConversationDto,
  ConversationRequestDto,
  ConversationRequestDtoV2} from 'src/application/dtos/common/conversation.dto';
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
import { AI_CONVERSATION_SERVICE, AI_SERVICE } from 'src/infrastructure/modules/ai.module';
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
  buildCombinedPromptV2,
  buildCombinedPromptV4,
  buildCombinedPromptV5
} from 'src/infrastructure/utils/prompt-builder';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConversationJobName,
  QueueName
} from 'src/application/constant/processor';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { ServerResponse } from 'node:http';

@ApiTags('Conversation')
@Controller('conversation')
export class ConversationController {
  constructor(
    @Inject(AI_CONVERSATION_SERVICE) private aiService: AIService,
    private conversationService: ConversationService,
    private logService: UserLogService,
    private orderService: OrderService,
    private profileService: ProfileService,
    private adminInstructionService: AdminInstructionService,
    @InjectQueue(QueueName.CONVERSATION_QUEUE)
    private readonly conversationQueue: Queue
  ) { }

  /** Lấy tất cả cuộc hội thoại */
  @Role(['admin'])
  @Get()
  @ApiOperation({ summary: 'Lấy tất cả cuộc hội thoại' })
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }

  /** Lấy cuộc hội thoại theo ID */
  @Role(['admin'])
  @Get(':id')
  @ApiOperation({ summary: 'Lấy cuộc hội thoại theo ID' })
  @ApiQuery({ name: 'id', type: String })
  async getConversationById(
    @Query('id') id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await this.conversationService.getConversationById(id);
  }

  /** Lấy danh sách cuộc hội thoại có phân trang (cải thiện so với getAllConversations) */
  @Role(['admin'])
  @Get('list/paged')
  @ApiOperation({ summary: 'Lấy danh sách cuộc hội thoại có phân trang' })
  @ApiBaseResponse(PagedResult<ConversationDto>)
  async getAllConversationsPaginated(
    @Query() request: PagedConversationRequest
  ): Promise<BaseResponse<PagedResult<ConversationDto>>> {
    return await this.conversationService.getAllConversationsPaginated(request);
  }


  private async processAiChatResponse(
    convertedMessages: UIMessage[],
    conversationMessages: any[],
    conversationId: string,
    userId: string,
    adminInstruction: string | undefined,
    combinedPrompt: string,
    endpoint: string,
    saveStrategy: 'sync' | 'queue' | 'queue_with_userid'
  ): Promise<ConversationDto> {
    const systemPrompt = conversationSystemPrompt(
      adminInstruction || ADVANCED_MATCHING_SYSTEM_PROMPT,
      combinedPrompt
    );

    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      systemPrompt,
      Output.object(searchOutput)
    );

    if (!message.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId, conversationId, service: 'AIService', endpoint }
      );
    }

    const responseConversation = overrideMessagesToConversation(
      conversationId || '',
      userId || '',
      addMessageToMessages(message.data || '', conversationMessages || [])
    );

    if (saveStrategy === 'sync') {
      await this.conversationService.saveOrUpdateConversation(responseConversation);
    } else if (saveStrategy === 'queue') {
      await this.conversationQueue.add(ConversationJobName.ADD_MESSAGE_AND_LOG, responseConversation);
    } else if (saveStrategy === 'queue_with_userid') {
      await this.conversationQueue.add(ConversationJobName.ADD_MESSAGE_AND_LOG, { responseConversation, userId });
    }

    return responseConversation;
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
          userId
        );

      const profile = await this.profileService.getOwnProfile(
        userId
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

    const adminSystemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_CONVERSATION);
    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', adminSystemPrompt, combinedPrompt, 'chat/v1', 'sync'
    );
    return Ok(responseConversation);
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
          userId
        );

      const profile = await this.profileService.getOwnProfile(
        userId
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

    const adminSystemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_CONVERSATION);
    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', adminSystemPrompt, combinedPrompt, 'chat/v2', 'sync'
    );
    return Ok(responseConversation);
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

    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', promptResult.data.adminInstruction, promptResult.data.combinedPrompt, 'chat/v3', 'sync'
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

    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', promptResult.data.adminInstruction, promptResult.data.combinedPrompt, 'chat/v4', 'sync'
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
      'Chat V5 - Common helper + log tom tat (có token: userId+profile+order, guest: không lấy log)'
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
          endpoint: 'chat/v4'
        }
      );
    }

    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', promptResult.data.adminInstruction, promptResult.data.combinedPrompt, 'chat/v5', 'queue'
    );
    return Ok(responseConversation);
  }

  /**
   * Chat V6 - Dựa trên V4 nhưng sử dụng nestjs/bull để xử lý log và AI response trong background job, tránh timeout cho user.
   * Logic tương tự V2 nhưng sử dụng buildCombinedPromptV2 helper.
   * @note userId được lấy từ JWT token. Guest (không có token) sẽ không lấy log/order/profile.
   */
  @Public()
  @Post('chat/v6')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V6 - Common helper + log chi tiết (có token: userId+profile+order, guest: không lấy log)'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV6(
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

    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', promptResult.data.adminInstruction, promptResult.data.combinedPrompt, 'chat/v6', 'queue_with_userid'
    );
    return Ok(responseConversation);
  }

  /**
   * Chat V7.
  */
  @Public()
  @Post('chat/v7')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V7'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV7(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDtoV2
  ): Promise<BaseResponse<ConversationDto>> {
    const userId =
      getTokenPayloadFromRequest(request)?.id ?? uuid();
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV4(
      INSTRUCTION_TYPE_CONVERSATION,
      this.logService,
      this.adminInstructionService,
      userId,
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

    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', promptResult.data.adminInstruction, promptResult.data.combinedPrompt, 'chat/v7', 'queue_with_userid'
    );
    return Ok(responseConversation);
  }

  /**
  * Chat V8.
 */
  @Public()
  @Post('chat/v8')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V8'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV8(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const userId = conversation.userId ??
      getTokenPayloadFromRequest(request)?.id ?? uuid();
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_CONVERSATION,
      this.adminInstructionService,
      userId,
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

    const responseConversation = await this.processAiChatResponse(
      convertedMessages, conversation.messages || [], conversation.id || '',
      userId || '', promptResult.data.adminInstruction, promptResult.data.combinedPrompt, 'chat/v6', 'queue_with_userid'
    );
    return Ok(responseConversation);
  }

  /**
 * Chat V9.
*/
  @Public()
  @Post('chat/v9')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Chat V9 - SSE stream'
  })
  @ApiBaseResponse(ConversationRequestDto)
  async conversationV9(
    @Req() request: Request,
    @Body() conversation: ConversationRequestDtoV2,
    @Res() response: ServerResponse
  ): Promise<any> {
    const userId =
      getTokenPayloadFromRequest(request)?.id ?? uuid();

    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Dùng common helper thay vì code trùng lặp
    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_CONVERSATION,
      this.adminInstructionService,
      userId,
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

    // Lay system prompt: uu tien admin instruction tu DB, fallback sang hardcode
    const systemPrompt = conversationSystemPrompt(
      promptResult.data.adminInstruction || ADVANCED_MATCHING_SYSTEM_PROMPT,
      promptResult.data.combinedPrompt
    );

    // Call AI service
    const stream = this.aiService.textGenerateStreamFromMessages(
      convertedMessages,
      systemPrompt,
      Output.object(searchOutput)
    );

    // Lưu conversation
    // const responseConversation = overrideMessagesToConversation(
    //   conversation.id || '',
    //   userId || '',
    //   addMessageToMessages(message.data || '', conversation.messages || [])
    // );

    // await this.conversationQueue.add(
    //   ConversationJobName.ADD_MESSAGE_AND_LOG,
    //   { responseConversation, userId }
    // );

    // return Ok(responseConversation);
    return pipeUIMessageStreamToResponse(
      {
        response: response,
        status: 200,
        statusText: 'OK',
        stream: stream,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        consumeSseStream: ({ stream }) => {
          // Optional: consume the SSE stream independently
          console.log('Consuming SSE stream:', stream);
        },
      }
    )
  }

}
