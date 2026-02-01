import { UserLogService } from "src/infrastructure/servicies/user-log.service";

export class LogController {
    constructor(private userLogService: UserLogService) {}

}