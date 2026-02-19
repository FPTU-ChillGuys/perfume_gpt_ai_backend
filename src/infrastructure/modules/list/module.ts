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
import { ToolModule } from "../tool.module";
import { UserLogModule } from "../user-log.module";
import { UserModule } from "../user.module";

export const modules = [
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
  AIAcceptanceModule,
  AdminInstructionModule,
  ProfileModule,
  EmailModule,
  UserModule,
];