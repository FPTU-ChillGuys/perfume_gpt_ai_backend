import { PagedAndSortedRequest } from "./paged-and-sorted.request"
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InventoryStockRequest extends PagedAndSortedRequest {
    @ApiPropertyOptional({ description: 'Filter by variant ID' })
    VariantId?: string;

    @ApiPropertyOptional({ description: 'Search term for filtering' })
    SearchTerm?: string;

    @ApiPropertyOptional({ description: 'Filter by low stock status' })
    IsLowStock?: boolean;

    constructor(init?: Partial<InventoryStockRequest>) {
        super();
        Object.assign(this, init);
    }
}