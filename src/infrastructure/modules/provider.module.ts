import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation.module';
import { PromptModule } from './prompt.module';
import { QuizModule } from './quiz.module';
import { MobileAIModule } from './mobile-ai.module';
import { WebAIModule } from './web-ai.module';
import { MobileAIController } from 'src/api/controllers/ai/mobile-ai.controller';

@Module({
  imports: [
    ConversationModule,
    PromptModule,
    QuizModule,
    MobileAIModule,
    WebAIModule
  ],
  controllers: [MobileAIController],
  exports: [
    ConversationModule,
    PromptModule,
    QuizModule,
    MobileAIModule,
    WebAIModule
  ]
})
export class ProviderModule {}
