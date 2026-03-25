import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from "./common/common.response";

/** Response chi tiết câu hỏi - câu trả lời survey */
export class SurveyQuestionAnswerDetailResponse extends CommonResponse {

    /** ID câu hỏi */
    @ApiProperty({ description: 'ID câu hỏi', format: 'uuid' })
    questionId!: string;

    /** Câu hỏi */
    @ApiProperty({ description: 'Câu hỏi' })
    question!: string;

    /** ID câu trả lời được chọn */
    @ApiProperty({ description: 'ID câu trả lời được chọn', format: 'uuid' })
    answerId!: string;

    /** Câu trả lời được chọn */
    @ApiProperty({ description: 'Câu trả lời được chọn' })
    answer!: string;
    
}
