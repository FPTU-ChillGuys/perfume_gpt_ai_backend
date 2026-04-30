import { Entity, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { TrendLogRepository } from 'src/infrastructure/domain/repositories/trend-log.repository';

@Entity({ repository: () => TrendLogRepository })
export class TrendLog extends Common {

    @ApiProperty({ description: 'Dữ liệu xu hướng (JSON string) từ AI trend response' })
    @Property({ type: 'text' })
    trendData!: string;

    constructor(init?: Partial<TrendLog>) {
        super();
        Object.assign(this, init);
    }
}
