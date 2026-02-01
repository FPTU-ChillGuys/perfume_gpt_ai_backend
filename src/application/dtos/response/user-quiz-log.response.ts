import { ApiProperty } from "@nestjs/swagger";
import { CommonResponse } from "./common/common.response";

export class UserQuizLogResponse extends CommonResponse{

    @ApiProperty()
    quizQuesAnsDetailId!: string;

    constructor(init?: Partial<UserQuizLogResponse>) {
        super();
        Object.assign(this, init);
    }
}