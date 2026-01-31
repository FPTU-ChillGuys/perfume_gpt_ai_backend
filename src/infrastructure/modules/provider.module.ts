import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation.module';
import { UserLogModule } from './user-log.module';
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
import { AIModule } from './ai.module';
import { AIController } from 'src/api/controllers/ai/ai.controller';

const modules = [
  ConversationModule,
  UserLogModule,
  QuizModule,
  MobileAIModule,
  WebAIModule,
  ProductModule,
  ToolModule,
  MappingModule,
  AIModule
];

@Module({
  imports: modules,
  controllers: [
    MobileAIController,
    ProductController,
    QuizController,
    ConversationController,
    AIController
  ],
  exports: modules
})
export class ProviderModule {}
