import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAttributeResponse } from './product.response';

/** Response thông tin tồn kho của một variant */
export class VariantStockResponse {
    /** ID tồn kho */
    @ApiProperty({ description: 'ID tồn kho', format: 'uuid' })
    id!: string;

    /** Tổng số lượng */
    @ApiProperty({ description: 'Tổng số lượng' })
    totalQuantity!: number;

    /** Số lượng đã đặt giữ */
    @ApiProperty({ description: 'Số lượng đã đặt giữ' })
    reservedQuantity!: number;

    /** Ngưỡng cảnh báo tồn kho thấp */
    @ApiProperty({ description: 'Ngưỡng cảnh báo tồn kho thấp' })
    lowStockThreshold!: number;
}

/** Response thông tin nồng độ nước hoa */
export class ConcentrationResponse {
    /** ID nồng độ */
    @ApiProperty({ description: 'ID nồng độ' })
    id!: number;

    /** Tên nồng độ (vd: 15-20% (Parfum)) */
    @ApiProperty({ description: 'Tên nồng độ', example: '15-20% (Parfum)' })
    name!: string;
}

/** Response thông tin media (hình ảnh) của variant */
export class VariantMediaResponse {
    /** ID media */
    @ApiProperty({ description: 'ID media', format: 'uuid' })
    id!: string;

    /** URL hình ảnh */
    @ApiProperty({ description: 'URL hình ảnh' })
    url!: string;

    /** Alt text */
    @ApiPropertyOptional({ description: 'Alt text', nullable: true })
    altText!: string | null;

    /** Có phải hình ảnh chính không */
    @ApiProperty({ description: 'Có phải hình ảnh chính không' })
    isPrimary!: boolean;

    /** Thứ tự hiển thị */
    @ApiProperty({ description: 'Thứ tự hiển thị' })
    displayOrder!: number;
}

/** Response thông tin một biến thể (variant) sản phẩm */
export class ProductVariantResponse {
    /** ID variant */
    @ApiProperty({ description: 'ID variant', format: 'uuid' })
    id!: string;

    /** ID sản phẩm */
    @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
    productId!: string;

    /** SKU */
    @ApiProperty({ description: 'SKU', example: 'SKU-GEN-32' })
    sku!: string;

    /** Barcode */
    @ApiProperty({ description: 'Barcode', example: 'BAR-1A78A674-6DE6-4C80-93C2-5717419684E7' })
    barcode!: string;

    /** Dung tích (ml) */
    @ApiProperty({ description: 'Dung tích (ml)', example: 100 })
    volumeMl!: number;

    /** Loại sản phẩm (FullBox, Decant...) */
    @ApiProperty({ description: 'Loại sản phẩm', example: 'FullBox' })
    type!: string;

    /** Giá gốc */
    @ApiProperty({ description: 'Giá gốc', example: 4327649.34 })
    basePrice!: number;

    /** Trạng thái variant */
    @ApiProperty({ description: 'Trạng thái variant', example: 'Active' })
    status!: string;

    /** ID nồng độ */
    @ApiProperty({ description: 'ID nồng độ' })
    concentrationId!: number;

    /** Thông tin nồng độ */
    @ApiPropertyOptional({ description: 'Thông tin nồng độ', type: () => ConcentrationResponse, nullable: true })
    concentration!: ConcentrationResponse | null;

    /** Thông tin tồn kho */
    @ApiPropertyOptional({ description: 'Thông tin tồn kho', type: () => VariantStockResponse, nullable: true })
    stock!: VariantStockResponse | null;

    /** Danh sách hình ảnh */
    @ApiProperty({ description: 'Danh sách hình ảnh', type: () => [VariantMediaResponse] })
    media!: VariantMediaResponse[];

    /** Danh sách thuộc tính của variant */
    @ApiProperty({ description: 'Danh sách thuộc tính variant', type: () => [ProductAttributeResponse] })
    attributes!: ProductAttributeResponse[];

    /** Độ lưu hương (Longevity) */
    @ApiPropertyOptional({ description: 'Độ lưu hương (Longevity)', example: 8 })
    longevity?: number;

    /** Độ tỏa hương (Sillage) */
    @ApiPropertyOptional({ description: 'Độ tỏa hương (Sillage)', example: 2 })
    sillage?: number;

    /** Ngày tạo */
    @ApiProperty({ description: 'Ngày tạo' })
    createdAt!: string;

    /** Ngày cập nhật */
    @ApiPropertyOptional({ description: 'Ngày cập nhật', nullable: true })
    updatedAt!: string | null;
}

/** Response thông tin sản phẩm kèm danh sách biến thể */
export class ProductWithVariantsResponse {
    /** ID sản phẩm */
    @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
    id!: string;

    /** Tên sản phẩm */
    @ApiProperty({ description: 'Tên sản phẩm' })
    name!: string;

    /** ID thương hiệu */
    @ApiProperty({ description: 'ID thương hiệu' })
    brandId!: number;

    /** Tên thương hiệu */
    @ApiProperty({ description: 'Tên thương hiệu' })
    brandName!: string;

    /** ID danh mục */
    @ApiProperty({ description: 'ID danh mục' })
    categoryId!: number;

    /** Tên danh mục */
    @ApiProperty({ description: 'Tên danh mục' })
    categoryName!: string;

    /** Mô tả sản phẩm */
    @ApiProperty({ description: 'Mô tả sản phẩm' })
    description!: string;

    /** URL hình ảnh chính */
    @ApiPropertyOptional({ description: 'URL hình ảnh chính', nullable: true })
    primaryImage!: string | null;

    /** Danh sách biến thể */
    @ApiProperty({ description: 'Danh sách biến thể', type: () => [ProductVariantResponse] })
    variants!: ProductVariantResponse[];

    /** Danh sách nốt hương */
    @ApiProperty({ description: 'Danh sách nốt hương', type: [String] })
    scentNotes!: string[];

    /** Danh sách nhóm hương */
    @ApiProperty({ description: 'Danh sách nhóm hương', type: [String] })
    olfactoryFamilies!: string[];

    /** Danh sách thuộc tính cấp sản phẩm */
    @ApiProperty({ description: 'Danh sách thuộc tính sản phẩm', type: () => [ProductAttributeResponse] })
    attributes!: ProductAttributeResponse[];

    /** Ngày tạo */
    @ApiProperty({ description: 'Ngày tạo' })
    createdAt!: string;

    /** Ngày cập nhật */
    @ApiPropertyOptional({ description: 'Ngày cập nhật', nullable: true })
    updatedAt!: string | null;
}
