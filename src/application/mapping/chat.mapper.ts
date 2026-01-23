import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { createMap, type Mapper } from '@automapper/core';
import { AddPromptRequest } from '../dtos/request/add-prompt.request';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';
import { UpdateResRequest } from '../dtos/request/update-response.request';
import { AddMessageRequest } from '../dtos/request/add-message.request';
import { Message } from 'src/domain/entities/message.entity';
import { QuizQuestionRequest } from '../dtos/request/add-quiz-question.request';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizAnswerRequest } from '../dtos/request/add-quiz-answer.request';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';

export class ChatProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  get profile() {
    return (mapper: Mapper) => {
      createMap(mapper, AddPromptRequest, AIRequestResponse);
      createMap(mapper, UpdateResRequest, AIRequestResponse);
      createMap(mapper, AddMessageRequest, Message);
      createMap(mapper, QuizAnswerRequest, QuizAnswer);
      createMap(mapper, QuizQuestionRequest, QuizQuestionAnswer);
    };
  }
}
