import { Module } from "@nestjs/common";
import { ReviewService } from "../servicies/review.service";
import { UnitOfWorkModule } from "./unit-of-work.module";

@Module({
  imports: [UnitOfWorkModule],
  providers: [ReviewService],
  exports: [ReviewService]
})
export class ReviewModule {}
