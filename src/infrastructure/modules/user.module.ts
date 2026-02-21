import { Module } from '@nestjs/common';
import { UserService } from '../servicies/user.service';

@Module({
  imports: [],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
