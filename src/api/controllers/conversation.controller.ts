import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ConversationResponse } from 'src/application/dtos/response/conversation.response';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Public()
  @Get()
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }
}
