import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation.module';
import { PromptModule } from './prompt.module';
import { QuizModule } from './quiz.module';
import { MobileAIModule } from './mobile-ai.module';
import { WebAIModule } from './web-ai.module';
import { MobileAIController } from 'src/api/controllers/ai/mobile-ai.controller';
import { ProductModule } from './product.module';
import { ProductController } from 'src/api/controllers/product.controller';

@Module({
  imports: [
    ConversationModule,
    PromptModule,
    QuizModule,
    MobileAIModule,
    WebAIModule,
    ProductModule
  ],
  controllers: [MobileAIController, ProductController],
  exports: [
    ConversationModule,
    PromptModule,
    QuizModule,
    MobileAIModule,
    WebAIModule,
    ProductModule
  ]
})
export class ProviderModule {}
