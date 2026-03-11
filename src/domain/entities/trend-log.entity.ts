import { Entity, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class TrendLog extends Common {

    @ApiProperty({ description: 'Dữ liệu xu hướng (JSON string) từ AI trend response' })
    @Property({ type: 'text' })
    trendData!: string;

    constructor(init?: Partial<TrendLog>) {
        super();
        Object.assign(this, init);
    }
}
