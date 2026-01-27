import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation.module';
import { PromptModule } from './prompt.module';
import { QuizModule } from './quiz.module';
import { MobileAIModule } from './mobile-ai.module';
import { WebAIModule } from './web-ai.module';
import { MobileAIController } from 'src/api/controllers/ai/mobile-ai.controller';
import { ProductModule } from './product.module';
import { ProductController } from 'src/api/controllers/product.controller';
import { ToolModule } from './tool.module';
import { QuizController } from 'src/api/controllers/quiz.controller';
import { MappingModule } from './mapping.module';
import { ConversationController } from 'src/api/controllers/conversation.controller';

const modules = [
  ConversationModule,
  PromptModule,
  QuizModule,
  MobileAIModule,
  WebAIModule,
  ProductModule,
  ToolModule,
  MappingModule
];

@Module({
  imports: modules,
  controllers: [
    MobileAIController,
    ProductController,
    QuizController,
    ConversationController
  ],
  exports: modules
})
export class ProviderModule {}
