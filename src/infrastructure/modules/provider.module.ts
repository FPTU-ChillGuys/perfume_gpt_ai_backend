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
import { ConversationController } from 'src/api/controllers/conversation.controller';
import { TrendController } from 'src/api/controllers/trend.controller';
import { ReviewController } from 'src/api/controllers/review.controller';
import { RecommendationController } from 'src/api/controllers/recommendation.controller';
import { ReviewModule } from './review.module';
import { InventoryModule } from './inventory.module';
import { InventoryController } from 'src/api/controllers/inventory.controller';
import { OrderModule } from './order.module';
import { AIAcceptanceModule } from './ai-acceptance.module';

const modules = [
  ConversationModule,
  UserLogModule,
  QuizModule,
  ProductModule,
  ToolModule,
  MappingModule,
  AIModule,
  UserLogModule,
  ReviewModule,
  InventoryModule,
  OrderModule,
  AIAcceptanceModule
];

@Module({
  imports: modules,
  controllers: [
    ProductController,
    QuizController,
    AIController,
    LogController,
    ConversationController,
    TrendController,
    ReviewController,
    RecommendationController,
    InventoryController,
  ],
  exports: modules
})
export class ProviderModule {}
