import { CommonResponse } from "./common/common.response";

export class UserQuizLogResponse extends CommonResponse{

    quizQuesAnsDetailId!: string;

    constructor(init?: Partial<UserQuizLogResponse>) {
        super();
        Object.assign(this, init);
    }
}