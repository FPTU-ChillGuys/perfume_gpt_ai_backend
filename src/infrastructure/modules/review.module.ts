import { Module } from "@nestjs/common";
import { ReviewService } from "../servicies/review.service";
import { HttpModule } from "@nestjs/axios";
import { UnitOfWorkModule } from "./unit-of-work.module";

@Module({
  imports: [HttpModule, UnitOfWorkModule],
  providers: [ReviewService],
  exports: [ReviewService]
})
export class ReviewModule {}
