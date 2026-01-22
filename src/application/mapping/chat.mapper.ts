import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { createMap, type Mapper } from '@automapper/core';
import { AddPromptRequest } from '../dtos/request/add-prompt.request';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';
import { UpdateResRequest } from '../dtos/request/update-response.request';
import { AddMessageRequest } from '../dtos/request/add-message.request';
import { Message } from 'src/domain/entities/message.entity';

export class ChatProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  get profile() {
    return (mapper: Mapper) => {
      createMap(mapper, AddPromptRequest, AIRequestResponse);
      createMap(mapper, UpdateResRequest, AIRequestResponse);
      createMap(mapper, AddMessageRequest, Message);
    };
  }
}
