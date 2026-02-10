import { ApiProperty } from "@nestjs/swagger";
import { CommonResponse } from "./common/common.response";

/** Response log quiz của người dùng */
export class UserQuizLogResponse extends CommonResponse{

    /** ID chi tiết câu hỏi - câu trả lời quiz */
    @ApiProperty({ description: 'ID chi tiết quiz', format: 'uuid' })
    quizQuesAnsDetailId!: string;

    constructor(init?: Partial<UserQuizLogResponse>) {
        super();
        Object.assign(this, init);
    }
}