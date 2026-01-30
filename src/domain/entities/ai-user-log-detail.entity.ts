import { Entity, OneToOne, Property } from "@mikro-orm/core";
import { ApiProperty } from "@nestjs/swagger";
import { Common } from "./common/common.entities";
import { Message } from "./message.entity";
import { QuizQuestionAnswerDetail } from "./quiz-question-answer-detail.entity";

@Entity()
export class AIUserLogDetail extends Common {

    //Log prompt content
    @ApiProperty()
    @Property()
    content?: string; 

    //Temp fix type
    @ApiProperty()
    @Property()
    type?: "prompt" = "prompt";

    @ApiProperty({ type: () => Message})
    @OneToOne(() => Message)
    message?: Message;

    @ApiProperty({ type: () => QuizQuestionAnswerDetail })
    @OneToOne(() => QuizQuestionAnswerDetail)
    quizQuesAnsDetail? : QuizQuestionAnswerDetail;

    constructor(init?: Partial<AIUserLogDetail>) {
        super();
        Object.assign(this, init);
    }
    
}