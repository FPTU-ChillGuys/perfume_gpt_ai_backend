import { AIService } from './ai.service';
import { ConversationService } from './conversation.service';
import { PromptService } from './prompt.service';
import { QuizService } from './quiz.service';

export class ServiceProvider {
  constructor(
    private conversationService: ConversationService,
    private promptService: PromptService,
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

  getPromptService(): PromptService {
    return this.promptService;
  }

  getQuizService(): QuizService {
    return this.quizService;
  }
}
