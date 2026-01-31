import { MessageDto } from "../common/message.dto";
import { CommonResponse } from "./common/common.response";

export class UserMessageLogResponse extends CommonResponse {

    messageId!: string;

    constructor(init?: Partial<UserMessageLogResponse>) {
        super();
        Object.assign(this, init);
    }

}