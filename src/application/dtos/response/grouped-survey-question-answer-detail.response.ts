import { ApiProperty } from '@nestjs/swagger';

/** Chi tiết một đáp án bên trong một câu hỏi đã nhóm */
export class SurveyGroupedAnswerItem {
    @ApiProperty({ description: 'ID detail tương ứng', format: 'uuid' })
    detailId!: string;

    @ApiProperty({ description: 'ID câu trả lời được chọn', format: 'uuid' })
    answerId!: string;

    @ApiProperty({ description: 'Câu trả lời được chọn' })
    answer!: string;
}

/** Response chi tiết câu hỏi (đã nhóm nhiều câu trả lời) */
export class GroupedSurveyQuestionAnswerDetailResponse {
    @ApiProperty({ description: 'ID câu hỏi', format: 'uuid' })
    questionId!: string;

    @ApiProperty({ description: 'Câu hỏi' })
    question!: string;

    @ApiProperty({ description: 'Danh sách các câu trả lời do người dùng chọn', type: [SurveyGroupedAnswerItem] })
    answers!: SurveyGroupedAnswerItem[];
}
