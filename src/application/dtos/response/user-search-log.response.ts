import { ApiProperty } from "@nestjs/swagger";
import { CommonResponse } from "./common/common.response";

/** Response log tìm kiếm của người dùng */
export class UserSearchLogResponse extends CommonResponse {

    /** Nội dung tìm kiếm */
    @ApiProperty({ description: 'Nội dung tìm kiếm' })
    searchText!: string;

    constructor(init?: Partial<UserSearchLogResponse>) {
        super();
        Object.assign(this, init);
    }

}
