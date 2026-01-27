import { Injectable } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { QuizQuestionAnswerRepository } from './quiz-question-answer.repository';
import { QuizQuestionRepository } from './quiz-question.repository';
import { AIRequestResponseRepository } from './ai-request-response.repository';
import { AIReviewSummaryRepository } from './review-summary.repository';
import { EntityManager } from '@mikro-orm/postgresql';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';
import { AIReviewSummary } from 'src/domain/entities/ai-review-summary.entity';

// @Injectable()
// export class UnitOfWork {
//   constructor(
//     private readonly aiConversationRepository: ConversationRepository,
//     private readonly aiQuizQuestionRepository: QuizQuestionRepository,
//     private readonly aiQuizQuestionAnswerRepository: QuizQuestionAnswerRepository,
//     private readonly aiRequestResponseRepository: AIRequestResponseRepository,
//     private readonly aiReviewSummaryRepository: AIReviewSummaryRepository,
//     private readonly em: EntityManager
//   ) {}

//   get AIConversationRepo(): ConversationRepository {
//     return this.aiConversationRepository;
//   }
//   get AIQuizQuestionRepo(): QuizQuestionRepository {
//     return this.aiQuizQuestionRepository;
//   }
//   get AIQuizQuestionAnswerRepo(): QuizQuestionAnswerRepository {
//     return this.aiQuizQuestionAnswerRepository;
//   }
//   get AIRequestResponseRepo(): AIRequestResponseRepository {
//     return this.aiRequestResponseRepository;
//   }
//   get AIReviewSummaryRepo(): AIReviewSummaryRepository {
//     return this.aiReviewSummaryRepository;
//   }

//   get getEntityManager(): EntityManager {
//     return this.em;
//   }
// }

@Injectable()
export class UnitOfWork {
  constructor(private readonly em: EntityManager) {}

  get AIConversationRepo(): ConversationRepository {
    return this.em.getRepository(Conversation);
  }

  get AIQuizQuestionRepo(): QuizQuestionRepository {
    return this.em.getRepository(QuizQuestion);
  }

  get AIQuizQuestionAnswerRepo(): QuizQuestionAnswerRepository {
    return this.em.getRepository(QuizQuestionAnswer);
  }

  get AIRequestResponseRepo(): AIRequestResponseRepository {
    return this.em.getRepository(AIRequestResponse);
  }

  get AIReviewSummaryRepo(): AIReviewSummaryRepository {
    return this.em.getRepository(AIReviewSummary);
  }

  get entityManager(): EntityManager {
    return this.em;
  }
}
