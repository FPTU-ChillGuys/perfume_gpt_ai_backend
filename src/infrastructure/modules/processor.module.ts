import { Module } from "@nestjs/common";
import { Conversation } from "src/domain/entities/conversation.entity";
import { ConversationProcessor } from "../processor/conversation.processor";
import { modules } from "./list/module";

const processors = [ConversationProcessor];

@Module({
    imports: [...modules],
    providers: [...processors],
    exports: [...processors]
})
export class ProcessorModule {}