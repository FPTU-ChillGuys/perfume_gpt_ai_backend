import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { AIAcceptanceModule } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.module';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { EmailModule } from 'src/infrastructure/domain/common/email.module';
import { InventoryModule } from 'src/infrastructure/domain/inventory/inventory.module';
import { MappingModule } from 'src/infrastructure/domain/common/mapping.module';
import { OrderModule } from 'src/infrastructure/domain/order/order.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { ProfileModule } from 'src/infrastructure/domain/profile/profile.module';
import { SurveyModule } from 'src/infrastructure/domain/survey/survey.module';
import { ReviewModule } from 'src/infrastructure/domain/review/review.module';
import { ReviewAIModule } from 'src/infrastructure/domain/review/review-ai.module';
import { RestockModule } from 'src/infrastructure/domain/restock/restock.module';
import { ToolModule } from 'src/infrastructure/domain/ai/tool.module';
import { TrendModule } from 'src/infrastructure/domain/trend/trend.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { UserLogAIModule } from 'src/infrastructure/domain/user-log/user-log-ai.module';
import { UserModule } from 'src/infrastructure/domain/user/user.module';
import { RecommendationModule } from 'src/infrastructure/domain/recommendation/recommendation.module';
import { ConversationModule } from "../../conversation/conversation.module";
import { CartModule } from 'src/infrastructure/domain/cart/cart.module';
import { DictionaryModule } from 'src/infrastructure/domain/common/dictionary.module';

export const modules = [
  ConversationModule,
  SurveyModule,
  ProductModule,
  ToolModule,
  MappingModule,
  AIModule,
  DictionaryModule,
  UserLogModule,
  UserLogAIModule,
  ReviewModule,
  ReviewAIModule,
  InventoryModule,
  OrderModule,
  AIAcceptanceModule,
  AdminInstructionModule,
  ProfileModule,
  EmailModule,
  UserModule,
  TrendModule,
  RecommendationModule,
  RestockModule,
  CartModule,
];
