import { Module } from "@nestjs/common";
import { Conversation } from "src/domain/entities/conversation.entity";
import { ConversationProcessor } from 'src/infrastructure/domain/processor/conversation.processor';
import { modules } from "./list/module";
import { SurveyProcessor } from 'src/infrastructure/domain/processor/survey.processor';
import { UserLogHelper } from 'src/infrastructure/domain/processor/helper/user-log.helper';
import { UserLogSummaryProcessor } from 'src/infrastructure/domain/processor/user-log-summary.processor';

const processors = [ConversationProcessor, SurveyProcessor, UserLogSummaryProcessor];
const helper = [UserLogHelper];

@Module({
    imports: [...modules],
    providers: [...processors, ...helper],
    exports: [...processors]
})
export class ProcessorModule { }
