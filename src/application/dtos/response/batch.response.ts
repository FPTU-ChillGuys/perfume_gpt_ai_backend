import { ApiProperty } from '@nestjs/swagger';

export class BatchResponse {
  @ApiProperty({
    type: String,
    description: 'Batch code',
    example: 'BATCH-001'
  })
  batchCode: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'The date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z',
    example: '2017-07-21T17:32:28Z'
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'The date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z',
    example: '2017-07-21T17:32:28Z'
  })
  expiryDate: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    type: Number,
    format: 'int32',
    description: 'Signed 32-bit integers (commonly used integer type).',
    example: 100
  })
  importQuantity: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'The date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z',
    example: '2017-07-21T17:32:28Z'
  })
  manufactureDate: string;

  @ApiProperty({
    type: Number,
    format: 'int32',
    description: 'Signed 32-bit integers (commonly used integer type).',
    example: 50
  })
  remainingQuantity: number;

  constructor(init?: Partial<BatchResponse>) {
    Object.assign(this, init);
  }
}
