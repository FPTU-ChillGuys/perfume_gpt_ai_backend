import { forwardRef } from "@nestjs/common";
import { AdminInstructionModule } from "../admin-instruction.module";
import { AIAcceptanceModule } from "../ai-acceptance.module";
import { AIModule } from "../ai.module";
import { ConversationModule } from "../conversation.module";
import { EmailModule } from "../email.module";
import { InventoryModule } from "../inventory.module";
import { MappingModule } from "../mapping.module";
import { OrderModule } from "../order.module";
import { ProductModule } from "../product.module";
import { ProfileModule } from "../profile.module";
import { QuizModule } from "../quiz.module";
import { ReviewModule } from "../review.module";
import { ReviewAIModule } from "../review-ai.module";
import { ToolModule } from "../tool.module";
import { TrendModule } from "../trend.module";
import { UserLogModule } from "../user-log.module";
import { UserLogAIModule } from "../user-log-ai.module";
import { UserModule } from "../user.module";
import { RecommendationModule } from "../recommendation.module";

export const modules = [
  ConversationModule,
  QuizModule,
  ProductModule,
  ToolModule,
  MappingModule,
  AIModule,
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
];