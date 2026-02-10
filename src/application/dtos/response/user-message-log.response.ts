import { ApiProperty } from "@nestjs/swagger";
import { CommonResponse } from "./common/common.response";

/** Response log tin nhắn của người dùng */
export class UserMessageLogResponse extends CommonResponse {

    /** ID tin nhắn được ghi log */
    @ApiProperty({ description: 'ID tin nhắn', format: 'uuid' })
    messageId!: string;

    constructor(init?: Partial<UserMessageLogResponse>) {
        super();
        Object.assign(this, init);
    }

}