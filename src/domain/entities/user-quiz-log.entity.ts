import { ApiProperty } from "@nestjs/swagger";
import { Common } from "./common/common.entities";
import { QuizQuestionAnswerDetail } from "./quiz-question-answer-detail.entity";
import { OneToOne } from "@mikro-orm/core";

export class UserQuizLog extends Common {

    @ApiProperty({ type: () => QuizQuestionAnswerDetail })
    @OneToOne(() => QuizQuestionAnswerDetail)
    quizQuesAnsDetail : QuizQuestionAnswerDetail

    constructor(init?: Partial<UserQuizLog>) {
        super();
        Object.assign(this, init);
    }

}