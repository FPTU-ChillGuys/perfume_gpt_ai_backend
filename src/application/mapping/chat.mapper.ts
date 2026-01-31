import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import {
  createMap,
  forMember,
  ignore,
  mapFrom,
  type Mapper
} from '@automapper/core';
import { Message } from 'src/domain/entities/message.entity';
import { QuizQuestionRequest } from '../dtos/request/quiz-question.request';
import { QuizAnswerRequest } from '../dtos/request/quiz-answer.request';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

export class ChatProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  get profile() {
    return (mapper: Mapper) => {
      createMap(
        mapper,
        QuizAnswerRequest,
        QuizAnswer,
        forMember((dest) => dest.question, ignore()),
        forMember(
          (dest) => dest.answer,
          mapFrom((src) => src.answer)
        )
      );
      createMap(
        mapper,
        QuizQuestionRequest,
        QuizQuestion,
        forMember((dest) => dest.answers, ignore()),
        forMember(
          (dest) => dest.question,
          mapFrom((src) => src.question)
        )
      );
    };
  }
}
