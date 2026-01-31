import { ApiProperty } from "@nestjs/swagger";
import { Common } from "./common/common.entities";
import { Property } from "@mikro-orm/core";

export class UserSearchLog extends Common {

    @ApiProperty()
    @Property()
    content?: string; 

    constructor(init?: Partial<UserSearchLog>) {
        super();
        Object.assign(this, init);
    }
}