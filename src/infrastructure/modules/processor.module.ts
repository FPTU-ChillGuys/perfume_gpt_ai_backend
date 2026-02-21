import { Module } from "@nestjs/common";
import { Conversation } from "src/domain/entities/conversation.entity";
import { ConversationProcessor } from "../processor/conversation.processor";
import { modules } from "./list/module";
import { QuizProcessor } from "../processor/quiz.processor";

const processors = [ConversationProcessor, QuizProcessor];

@Module({
    imports: [...modules],
    providers: [...processors],
    exports: [...processors]
})
export class ProcessorModule {}