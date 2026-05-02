import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GenderIntent {
  MALE = 'Male',
  FEMALE = 'Female',
  UNISEX = 'Unisex'
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

  @ApiProperty({
    description: 'Giới tính',
    enum: GenderIntent,
    required: false
  })
  @IsEnum(GenderIntent)
  @IsOptional()
  gender?: GenderIntent;

  @ApiProperty({ description: 'Xuất xứ', required: false })
  @IsString()
  @IsOptional()
  origin?: string;

  @ApiProperty({ description: 'Năm ra mắt', required: false, example: 2020 })
  @IsNumber()
  @IsOptional()
  releaseYear?: number;

  @ApiProperty({ description: 'Giá tối thiểu', required: false })
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiProperty({ description: 'Giá tối đa', required: false })
  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @ApiProperty({
    description: 'Nốt hương đầu',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  topNotes?: string[];

  @ApiProperty({
    description: 'Nốt hương giữa',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  middleNotes?: string[];

  @ApiProperty({
    description: 'Nốt hương cuối',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  baseNotes?: string[];

  @ApiProperty({
    description: 'Các nốt hương (scent notes)',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  notes?: string[];

  @ApiProperty({
    description: 'Nhóm hương (olfactory families)',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  families?: string[];

  @ApiProperty({
    description: 'Nồng độ (Concentration: EDP, EDT, ...)',
    required: false
  })
  @IsString()
  @IsOptional()
  concentration?: string;

  @ApiProperty({ description: 'Dung tích (ml)', required: false })
  @IsNumber()
  @IsOptional()
  volume?: number;

  @ApiProperty({ description: 'Loại variant', required: false })
  @IsString()
  @IsOptional()
  variantType?: string;

  @ApiProperty({
    description: 'Dịp sử dụng (đi tiệc, đi làm, ...)',
    required: false
  })
  @IsString()
  @IsOptional()
  occasion?: string;

  @ApiProperty({ description: 'Thời tiết/Mùa phù hợp', required: false })
  @IsString()
  @IsOptional()
  weatherSeason?: string;

  @ApiProperty({ description: 'Nhóm tuổi phù hợp', required: false })
  @IsString()
  @IsOptional()
  ageGroup?: string;

  @ApiProperty({ description: 'Phong cách', required: false })
  @IsString()
  @IsOptional()
  style?: string;

  @ApiProperty({ description: 'Đặc tính mùi hương', required: false })
  @IsString()
  @IsOptional()
  scentCharacter?: string;

  @ApiProperty({ description: 'Thời điểm trong ngày', required: false })
  @IsString()
  @IsOptional()
  timeOfDay?: string;

  @ApiProperty({ description: 'Phù hợp làm quà tặng', required: false })
  @IsString()
  @IsOptional()
  giftSuitability?: string;

  @ApiProperty({ description: 'Loại da phù hợp', required: false })
  @IsString()
  @IsOptional()
  skinType?: string;

  @ApiProperty({ description: 'Mùa sử dụng', required: false })
  @IsString()
  @IsOptional()
  season?: string;

  @ApiProperty({
    description: 'Mô tả thêm hoặc ngữ cảnh',
    required: false,
    nullable: true
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Độ lưu hương tối thiểu (longevity)',
    required: false,
    example: 6
  })
  @IsNumber()
  @IsOptional()
  minLongevity?: number;

  @ApiProperty({
    description: 'Độ tỏa hương tối thiểu (sillage)',
    required: false,
    example: 2
  })
  @IsNumber()
  @IsOptional()
  minSillage?: number;
}
