import { CommonResponse } from "./common/common.response";

export class UserSearchLogResponse extends CommonResponse {

    searchText!: string;

    constructor(init?: Partial<UserSearchLogResponse>) {
        super();
        Object.assign(this, init);
    }

}