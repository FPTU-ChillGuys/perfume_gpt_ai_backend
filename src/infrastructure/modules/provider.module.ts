import { Module } from '@nestjs/common';
import { ProductController } from 'src/api/controllers/product.controller';
import { QuizController } from 'src/api/controllers/quiz.controller';
import { AIController } from 'src/api/controllers/ai/ai.controller';
import { LogController } from 'src/api/controllers/log.controller';
import { ConversationController } from 'src/api/controllers/conversation.controller';
import { TrendController } from 'src/api/controllers/trend.controller';
import { ReviewController } from 'src/api/controllers/review.controller';
import { RecommendationController } from 'src/api/controllers/recommendation.controller';
import { InventoryController } from 'src/api/controllers/inventory.controller';
import { AIAcceptanceController } from 'src/api/controllers/ai-acceptance.controller';
import { AdminInstructionController } from 'src/api/controllers/admin-instruction.controller';
import { OrderController } from 'src/api/controllers/order.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';
import { ProcessorModule } from './processor.module';
import { modules } from './list/module';

const registerQueue = BullModule.registerQueue(
  ...Object.values(QueueName).map((value) => ({ name: value }))
);

@Module({
  imports: [...modules, registerQueue, ProcessorModule],
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
    AIAcceptanceController,
    AdminInstructionController,
    OrderController
  ],
  exports: modules
})
export class ProviderModule {}
