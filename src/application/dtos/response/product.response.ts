import { ApiProperty } from '@nestjs/swagger';
import { Gender } from 'src/domain/enum/gender.enum';

/** Response thông tin sản phẩm nước hoa */
export class ProductResponse {
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

  /** ID dòng hương */
  @ApiProperty({ description: 'ID dòng hương', nullable: true })
  familyId!: number | null;

  /** Tên dòng hương */
  @ApiProperty({ description: 'Tên dòng hương', nullable: true })
  familyName!: string | null;

  /** Giới tính hướng đến */
  @ApiProperty({ description: 'Giới tính hướng đến', enum: Gender })
  gender: Gender;

  /** Mô tả sản phẩm */
  @ApiProperty({ description: 'Mô tả sản phẩm' })
  description!: string;

  /** Hương đầu (top notes) */
  @ApiProperty({ description: 'Hương đầu (top notes)' })
  topNotes!: string;

  /** Hương giữa (middle notes) */
  @ApiProperty({ description: 'Hương giữa (middle notes)' })
  middleNotes!: string;

  /** Hương cuối (base notes) */
  @ApiProperty({ description: 'Hương cuối (base notes)' })
  baseNotes!: string;
}

