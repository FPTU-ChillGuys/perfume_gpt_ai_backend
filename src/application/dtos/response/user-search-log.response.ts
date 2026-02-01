import { ApiProperty } from "@nestjs/swagger";
import { CommonResponse } from "./common/common.response";

export class UserSearchLogResponse extends CommonResponse {

    @ApiProperty()
    searchText!: string;

    constructor(init?: Partial<UserSearchLogResponse>) {
        super();
        Object.assign(this, init);
    }

}