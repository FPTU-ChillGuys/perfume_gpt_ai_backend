import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderQuestionItem {
  @ApiProperty({ description: 'ID câu hỏi', format: 'uuid' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: 'Thứ tự mới' })
  @IsNumber()
  order!: number;
}

export class ReorderQuestionsRequest {
  @ApiProperty({
    description: 'Danh sách thứ tự câu hỏi',
    type: [ReorderQuestionItem]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderQuestionItem)
  orders!: ReorderQuestionItem[];
}
