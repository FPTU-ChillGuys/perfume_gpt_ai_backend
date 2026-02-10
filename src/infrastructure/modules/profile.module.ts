import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ProfileService } from "../servicies/profile.service";
import { ProfileController } from "src/api/controllers/profile.controller";

@Module({
  imports: [HttpModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService]
})
export class ProfileModule {}
