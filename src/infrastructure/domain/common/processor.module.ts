import { Module } from "@nestjs/common";
import { SurveyProcessor } from 'src/infrastructure/domain/processor/survey.processor';
import { UserLogHelper } from 'src/infrastructure/domain/processor/helper/user-log.helper';
import { UserLogSummaryProcessor } from 'src/infrastructure/domain/processor/user-log-summary.processor';
import { ReviewProcessor } from 'src/infrastructure/domain/processor/review.processor';
import { modules } from "./list/module";

const processors = [SurveyProcessor, UserLogSummaryProcessor, ReviewProcessor];
const helper = [UserLogHelper];

@Module({
    imports: [...modules],
    providers: [...processors, ...helper],
    exports: [...processors]
})
export class ProcessorModule { }
