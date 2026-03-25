import { PagedAndSortedRequest } from "./paged-and-sorted.request"
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class InventoryStockRequest extends PagedAndSortedRequest {
    @ApiPropertyOptional({ description: 'Filter by variant ID' })
    @IsOptional()
    @IsUUID()
    VariantId?: string;

    @ApiPropertyOptional({ description: 'Search term for filtering' })
    @IsOptional()
    SearchTerm?: string;

    @ApiPropertyOptional({ description: 'Filter by low stock status' })
    @IsOptional()
    @IsBoolean()
    IsLowStock?: boolean;

    constructor(init?: Partial<InventoryStockRequest>) {
        super();
        Object.assign(this, init);
    }
}
