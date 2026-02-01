import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation.module';
import { UserLogModule } from './user-log.module';
import { QuizModule } from './quiz.module';
import { ProductModule } from './product.module';
import { ProductController } from 'src/api/controllers/product.controller';
import { ToolModule } from './tool.module';
import { QuizController } from 'src/api/controllers/quiz.controller';
import { MappingModule } from './mapping.module';
import { AIModule } from './ai.module';
import { AIController } from 'src/api/controllers/ai/ai.controller';
import { LogController } from 'src/api/controllers/log.controller';
import { ChatController } from 'src/api/controllers/chat.controller';

const modules = [
  ConversationModule,
  UserLogModule,
  QuizModule,
  ProductModule,
  ToolModule,
  MappingModule,
  AIModule,
  UserLogModule
];

@Module({
  imports: modules,
  controllers: [
    ProductController,
    QuizController,
    AIController,
    LogController,
    ChatController
  ],
  exports: modules
})
export class ProviderModule {}
