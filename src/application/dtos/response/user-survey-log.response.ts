import { ApiProperty } from "@nestjs/swagger";
import { CommonResponse } from "./common/common.response";

/** Response log survey của người dùng */
export class UserSurveyLogResponse extends CommonResponse{

    /** ID chi tiết câu hỏi - câu trả lời survey */
    @ApiProperty({ description: 'ID chi tiết survey', format: 'uuid' })
    surveyQuesAnsDetailId!: string;

    constructor(init?: Partial<UserSurveyLogResponse>) {
        super();
        Object.assign(this, init);
    }
}
