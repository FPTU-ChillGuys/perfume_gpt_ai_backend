import { AIService } from './ai.service';
import { ConversationService } from './conversation.service';
import { UserLogService } from './user-log.service';
import { QuizService } from './quiz.service';

export class ServiceProvider {
  constructor(
    private conversationService: ConversationService,
    private userLogService: UserLogService,
    private quizService: QuizService
  ) {}

  getConversationService(): ConversationService {
    return this.conversationService;
  }

  getMobileAIService(): AIService {
    return new AIService('mobile');
  }

  geWebAIService(): AIService {
    return new AIService('web');
  }

  getUserLogService(): UserLogService {
    return this.userLogService;
  }

  getQuizService(): QuizService {
    return this.quizService;
  }
}
