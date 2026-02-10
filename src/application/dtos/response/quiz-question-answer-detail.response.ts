import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from "./common/common.response";

/** Response chi tiết câu hỏi - câu trả lời quiz */
export class QuizQuestionAnswerDetailResponse extends CommonResponse {

    /** ID câu hỏi */
    @ApiProperty({ description: 'ID câu hỏi', format: 'uuid' })
    questionId!: string;

    /** ID câu trả lời được chọn */
    @ApiProperty({ description: 'ID câu trả lời được chọn', format: 'uuid' })
    answerId!: string;
    
}