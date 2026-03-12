import { Module } from "@nestjs/common";
import { ReviewService } from "../servicies/review.service";
import { UnitOfWorkModule } from "./unit-of-work.module";
import { AIModule } from "./ai.module";
import { AdminInstructionModule } from "./admin-instruction.module";

@Module({
  imports: [UnitOfWorkModule, AIModule, AdminInstructionModule],
  providers: [ReviewService],
  exports: [ReviewService]
})
export class ReviewModule {}
