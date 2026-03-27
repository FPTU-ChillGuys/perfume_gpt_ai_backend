import { IsOptional, IsString, IsNumber, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GenderIntent {
    MALE = 'Male',
    FEMALE = 'Female',
    UNISEX = 'Unisex',
}

export class SearchObjectDto {
    @ApiProperty({ description: 'Thương hiệu', required: false })
    @IsString()
    @IsOptional()
    brand?: string;

    @ApiProperty({ description: 'Tên sản phẩm', required: false })
    @IsString()
    @IsOptional()
    productName?: string;

    @ApiProperty({ description: 'Danh mục', required: false })
    @IsString()
    @IsOptional()
    category?: string;

    @ApiProperty({ description: 'Giới tính', enum: GenderIntent, required: false })
    @IsEnum(GenderIntent)
    @IsOptional()
    gender?: GenderIntent;

    @ApiProperty({ description: 'Giá tối thiểu', required: false })
    @IsNumber()
    @IsOptional()
    minPrice?: number;

    @ApiProperty({ description: 'Giá tối đa', required: false })
    @IsNumber()
    @IsOptional()
    maxPrice?: number;

    @ApiProperty({ description: 'Các nốt hương (scent notes)', required: false, type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    notes?: string[];

    @ApiProperty({ description: 'Nhóm hương (olfactory families)', required: false, type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    families?: string[];

    @ApiProperty({ description: 'Nồng độ (Concentration: EDP, EDT, ...)', required: false })
    @IsString()
    @IsOptional()
    concentration?: string;

    @ApiProperty({ description: 'Dung tích (ml)', required: false })
    @IsNumber()
    @IsOptional()
    volume?: number;

    @ApiProperty({ description: 'Dịp sử dụng (Hẹn hò, đi làm, đi tiệc...)', required: false })
    @IsString()
    @IsOptional()
    occasion?: string;

    @ApiProperty({ description: 'Mùa sử dụng (Xuân, Hạ, Thu, Đông)', required: false })
    @IsString()
    @IsOptional()
    season?: string;

    @ApiProperty({ description: 'Mô tả thêm hoặc ngữ cảnh', required: false })
    @IsString()
    @IsOptional()
    description?: string;
}
