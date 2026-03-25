import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import {
  createMap,
  forMember,
  ignore,
  mapFrom,
  type Mapper
} from '@automapper/core';
import { Message } from 'src/domain/entities/message.entity';
import { SurveyQuestionRequest } from '../dtos/request/survey-question.request';
import { SurveyAnswerRequest } from '../dtos/request/survey-answer.request';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';

export class ChatProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  get profile() {
    return (mapper: Mapper) => {
      createMap(
        mapper,
        SurveyAnswerRequest,
        SurveyAnswer,
        forMember((dest) => dest.question, ignore()),
        forMember(
          (dest) => dest.answer,
          mapFrom((src) => src.answer)
        )
      );
      createMap(
        mapper,
        SurveyQuestionRequest,
        SurveyQuestion,
        forMember((dest) => dest.answers, ignore()),
        forMember(
          (dest) => dest.question,
          mapFrom((src) => src.question)
        )
      );
    };
  }
}
