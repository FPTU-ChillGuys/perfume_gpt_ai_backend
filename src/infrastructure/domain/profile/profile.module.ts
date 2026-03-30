import { Module } from "@nestjs/common";
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { ProfileController } from "src/api/controllers/profile.controller";
import { ProfileTool } from "src/chatbot/utils/tools/profile.tool";

@Module({
  imports: [],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileTool],
  exports: [ProfileService, ProfileTool]
})
export class ProfileModule {}
