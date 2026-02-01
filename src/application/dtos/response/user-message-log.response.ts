import { ApiProperty } from "@nestjs/swagger";
import { MessageDto } from "../common/message.dto";
import { CommonResponse } from "./common/common.response";

export class UserMessageLogResponse extends CommonResponse {

    @ApiProperty()
    messageId!: string;

    constructor(init?: Partial<UserMessageLogResponse>) {
        super();
        Object.assign(this, init);
    }

}