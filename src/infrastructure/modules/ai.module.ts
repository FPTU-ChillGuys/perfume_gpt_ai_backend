import { SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { AIService } from '../servicies/ai.service';
import { Tools } from 'src/chatbot/utils/tools';
import { Module, Provider } from '@nestjs/common';
import { UnitOfWorkModule } from './unit-of-work.module';
import { ToolModule } from './tool.module';

export const AI_SERVICE = 'AI_SERVICE';

export const AI_CONVERSATION_SERVICE = 'AI_CONVERSATION_SERVICE';

export const AI_TREND_SERVICE = 'AI_TREND_SERVICE';

export const AI_RECOMMENDATION_AND_REPURCHASE_SERVICE = 'AI_RECOMMENDATION_AND_REPURCHASE_SERVICE';

const aiProvider: Provider = {
  provide: AI_SERVICE,
  useFactory: (tools: Tools) => {
    return new AIService(SYSTEM_PROMPT, tools.getTools, 10);
  },
  inject: [Tools]
};

const aiConversationProvider: Provider = {
  provide: AI_CONVERSATION_SERVICE,
  useFactory: (tools: Tools) => {
    return new AIService(SYSTEM_PROMPT, tools.getToolsForChatbot, 10);
  },
  inject: [Tools]
};

const aiTrendProvider: Provider = {
  provide: AI_TREND_SERVICE,
  useFactory: (tools: Tools) => {
    return new AIService(SYSTEM_PROMPT, tools.getToolsForTrend, 10);
  },
  inject: [Tools]
};

const aiRecommendationAndRepurchaseProvider: Provider = {
  provide: AI_RECOMMENDATION_AND_REPURCHASE_SERVICE,
  useFactory: (tools: Tools) => {
    return new AIService(SYSTEM_PROMPT, tools.getToolsForRecomendationAndRepurchase, 10);
  },
  inject: [Tools]
};

@Module({
  imports: [UnitOfWorkModule, ToolModule],
  providers: [aiProvider, aiConversationProvider, aiTrendProvider, aiRecommendationAndRepurchaseProvider],
  exports: [aiProvider, aiConversationProvider, aiTrendProvider, aiRecommendationAndRepurchaseProvider]
})
export class AIModule {}
