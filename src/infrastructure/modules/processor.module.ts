import { Module } from "@nestjs/common";
import { Conversation } from "src/domain/entities/conversation.entity";
import { ConversationProcessor } from "../processor/conversation.processor";
import { modules } from "./list/module";
import { SurveyProcessor } from "../processor/survey.processor";
import { UserLogHelper } from "../processor/helper/user-log.helper";
import { UserLogSummaryProcessor } from "../processor/user-log-summary.processor";

const processors = [ConversationProcessor, SurveyProcessor, UserLogSummaryProcessor];
const helper = [UserLogHelper];

@Module({
    imports: [...modules],
    providers: [...processors, ...helper],
    exports: [...processors]
})
export class ProcessorModule { }
