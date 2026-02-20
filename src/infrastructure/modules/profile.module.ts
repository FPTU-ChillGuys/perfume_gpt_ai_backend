import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ProfileService } from "../servicies/profile.service";
import { ProfileController } from "src/api/controllers/profile.controller";
import { ProfileTool } from "src/chatbot/utils/tools/profile.tool";

@Module({
  imports: [HttpModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileTool],
  exports: [ProfileService, ProfileTool]
})
export class ProfileModule {}
