import { ApiProperty } from "@nestjs/swagger";

/** Request tạo bản tóm tắt log người dùng */
export class UserLogSummaryRequest {
    /** ID người dùng */
    @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
    userId: string;

    /** Ngày bắt đầu */
    @ApiProperty({ description: 'Ngày bắt đầu khoảng thời gian' })
    startDate: Date;

    /** Ngày kết thúc */
    @ApiProperty({ description: 'Ngày kết thúc khoảng thời gian' })
    endDate: Date;

    /** Nội dung tóm tắt */
    @ApiProperty({ description: 'Nội dung tóm tắt log', default: '' })
    logSummary: string = '';
}