import { ApiProperty } from '@nestjs/swagger';

export class SlowStockVariantResponse {
    @ApiProperty({ description: 'ID variant', format: 'uuid' })
    id: string;

    @ApiProperty({ description: 'SKU của variant' })
    sku: string;

    @ApiProperty({ description: 'Tên sản phẩm' })
    productName: string;

    @ApiProperty({ description: 'Dung tích (ml)' })
    volumeMl: number;

    @ApiProperty({ description: 'Loại variant', example: 'Eau de Parfum' })
    type: string;

    @ApiProperty({ description: 'Giá gốc' })
    basePrice: number;

    @ApiProperty({ description: 'Trạng thái variant' })
    status: string;

    @ApiProperty({ description: 'Tên nồng độ', nullable: true })
    concentrationName: string | null;

    @ApiProperty({ description: 'Tồn kho hiện tại' })
    totalQuantity: number;

    @ApiProperty({ description: 'Trung bình số lượng bán mỗi ngày' })
    averageDailySales: number;

    @ApiProperty({ description: 'Số ngày cung cấp tồn kho' })
    daysOfSupply: number;

    @ApiProperty({ description: 'Xu hướng bán hàng', enum: ['INCREASING', 'STABLE', 'DECLINING'] })
    trend: 'INCREASING' | 'STABLE' | 'DECLINING';

    @ApiProperty({ description: 'Độ biến động', enum: ['LOW', 'MEDIUM', 'HIGH'] })
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';

    @ApiProperty({ description: 'Mức rủi ro', enum: ['CRITICAL', 'HIGH', 'MEDIUM'] })
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';

    @ApiProperty({ description: 'Phân loại', enum: ['current_slow', 'early_warning'] })
    category: 'current_slow' | 'early_warning';

    @ApiProperty({ description: 'Hành động đề xuất', enum: ['discontinue', 'clearance', 'discount', 'monitor', 'reduce_restock'] })
    action: 'discontinue' | 'clearance' | 'discount' | 'monitor' | 'reduce_restock';

    @ApiProperty({ description: 'Lý do đề xuất' })
    reason: string;

    static fromAIResult(variant: Record<string, unknown>): SlowStockVariantResponse | null {
        if (!variant) return null;
        const response = new SlowStockVariantResponse();
        Object.assign(response, variant);
        return response;
    }
}