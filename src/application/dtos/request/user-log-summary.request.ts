import { ApiProperty } from "@nestjs/swagger";

export class UserLogSummaryRequest {
    @ApiProperty()
    userId: string;
    @ApiProperty()
    startDate: Date;
    @ApiProperty()
    endDate: Date;
    @ApiProperty()
    logSummary?: string;
}