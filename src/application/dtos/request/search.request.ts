import { IsOptional, IsString } from "class-validator";
import { PagedAndSortedRequest } from "./paged-and-sorted.request";
import { ApiProperty } from "@nestjs/swagger";

export class SearchRequest extends PagedAndSortedRequest {

    @ApiProperty({ description: 'Từ khóa tìm kiếm', default: '' })
    @IsString()
    @IsOptional()
    searchText: string;
}