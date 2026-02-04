import { Module } from "@nestjs/common";
import { ReviewService } from "../servicies/review.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  providers: [ReviewService],
  exports: [ReviewService]
})
export class ReviewModule {}
