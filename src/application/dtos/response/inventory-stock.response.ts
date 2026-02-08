import { ApiProperty } from '@nestjs/swagger';

export class InventoryStockResponse {
    @ApiProperty({ description: 'Concentration name', example: 'Eau de Parfum' })
    concentrationName: string;

    @ApiProperty({ description: 'Inventory stock ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Whether the stock is low', example: false })
    isLowStock: boolean;

    @ApiProperty({ description: 'Low stock threshold', example: 10 })
    lowStockThreshold: number;

    @ApiProperty({ description: 'Product name', example: 'Chanel No.5' })
    productName: string;

    @ApiProperty({ description: 'Total quantity in stock', example: 100 })
    totalQuantity: number;

    @ApiProperty({ description: 'Variant ID', example: '550e8400-e29b-41d4-a716-446655440001' })
    variantId: string;

    @ApiProperty({ description: 'Variant SKU', example: 'CHN5-EDP-100ML' })
    variantSku: string;

    @ApiProperty({ description: 'Volume in milliliters', example: 100 })
    volumeMl: number;

    constructor(init?: Partial<InventoryStockResponse>) {
        Object.assign(this, init);
    }
}