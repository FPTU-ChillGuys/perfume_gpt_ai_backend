import { ApiProperty } from '@nestjs/swagger';

export class MobileSurveyAnswerItem {
  @ApiProperty({ description: 'ID câu trả lời' })
  id!: string;

  @ApiProperty({ description: 'Nội dung gốc' })
  answer!: string;

  @ApiProperty({ description: 'Nội dung hiển thị đã parse' })
  displayText!: string;
}

export class MobileSurveyQuestionItem {
  @ApiProperty({ description: 'ID câu hỏi' })
  id!: string;

  @ApiProperty({ description: 'Nội dung câu hỏi' })
  question!: string;

  @ApiProperty({ description: 'Loại câu hỏi', example: 'single' })
  questionType!: string;

  @ApiProperty({ description: 'Thứ tự hiển thị' })
  order!: number;

  @ApiProperty({ description: 'Trạng thái hoạt động' })
  isActive!: boolean;

  @ApiProperty({
    type: [MobileSurveyAnswerItem],
    description: 'Danh sách câu trả lời'
  })
  answers!: MobileSurveyAnswerItem[];
}

export class MobileSurveyProduct {
  @ApiProperty({ description: 'ID sản phẩm' })
  id!: string;

  @ApiProperty({ description: 'Tên sản phẩm' })
  name!: string;

  @ApiProperty({ description: 'Tên thương hiệu' })
  brandName!: string;

  @ApiProperty({ description: 'URL ảnh chính' })
  primaryImage!: string;

  @ApiProperty({ description: 'Lý do AI gợi ý' })
  reasoning!: string;

  @ApiProperty({ description: 'Giá thấp nhất' })
  minPrice!: number;

  @ApiProperty({ description: 'Giá cao nhất' })
  maxPrice!: number;
}

export class MobileSurveyMessage {
  @ApiProperty({ description: 'Tin nhắn tư vấn từ AI' })
  message!: string;

  @ApiProperty({
    type: [MobileSurveyProduct],
    description: 'Danh sách sản phẩm kèm theo'
  })
  products!: MobileSurveyProduct[];
}

export class MobileSurveyResponseData {
  @ApiProperty({
    type: [MobileSurveyMessage],
    description: 'Danh sách tin nhắn và sản phẩm'
  })
  messages!: MobileSurveyMessage[];

  @ApiProperty({
    type: [MobileSurveyProduct],
    description: 'Danh sách tất cả sản phẩm (đã gộp)'
  })
  products!: MobileSurveyProduct[];
}
