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
import { Public } from 'src/application/common/Metadata';
import {
  ConversationDto,
  ConversationRequestDto
} from 'src/application/dtos/common/conversation.dto';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
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

@ApiTags('Conversation')
@Controller('conversation')
export class ConversationController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private conversationService: ConversationService,
    private logService: UserLogService,
    private orderService: OrderService
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

    // Ket hop prompt tu log nguoi dung va report don hang
    const combinedPrompt = `${userLogPromptText}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}`;

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
    const userLogResponse = await this.logService.getReportAndPromptSummaryUserLogs({
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

    // Ket hop prompt tu log nguoi dung va report don hang
    // Lay response tu user log service
    const combinedPrompt = `${userLogResponse.data ? userLogResponse.data.response : ''}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}`;

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

    const combinedPrompt = `${userLogPromptText}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}`;

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
  @ApiBaseResponse(ConversationRequestDto)
  async convserationV2Test(
    @Req() request: Request,
    @Query('userId') userId: string,
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    // -----------------------------Test V1 -------------------------------------
    // Lay log nguoi dung tu db trong khoan 1 thang
    const userLogResponse = await this.logService.getReportAndPromptSummaryUserLogs({
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

    const combinedPrompt = `${userLogResponse.data ? userLogResponse.data.response : ''}\n\n
    Order Report:\n${orderReportPrompt(orderReport.data ?? '')}`;

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
}
