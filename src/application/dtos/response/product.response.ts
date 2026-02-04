import { ApiProperty } from '@nestjs/swagger';
import { Gender } from 'src/domain/enum/gender.enum';

export class ProductResponse {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  brandId!: number;
  @ApiProperty()
  brandName!: string;
  @ApiProperty()
  categoryId!: number;
  @ApiProperty()
  categoryName!: string;
  @ApiProperty()
  familyId!: number | null;
  @ApiProperty()
  familyName!: string | null;
  @ApiProperty()
  gender: Gender;
  @ApiProperty()
  description!: string;
  @ApiProperty()
  topNotes!: string;
  @ApiProperty()
  middleNotes!: string;
  @ApiProperty()
  baseNotes!: string;
}

